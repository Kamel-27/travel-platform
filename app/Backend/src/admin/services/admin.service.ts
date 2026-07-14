import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  EntityManager,
  FindOptionsWhere,
  In,
  IsNull,
  LessThan,
  Not,
  Repository,
} from 'typeorm';

import { User } from '../../users/user.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import {
  MarkupRule,
  MarkupType,
} from '../../bookings/entities/markup-rule.entity';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { Refund, RefundStatus } from '../../payments/entities/refund.entity';
import { PaymentWebhookEvent } from '../../payments/entities/payment-webhook-event.entity';
import { DuffelService } from '../../duffel/duffel.service';
import { BookingStateMachineService } from '../../bookings/services/booking-state-machine.service';
import { RefundExecutionService } from '../../bookings/services/refund-execution.service';
import {
  REFUND_EXECUTION_JOB,
  REFUND_EXECUTION_QUEUE,
  refundExecutionJobOptions,
} from '../../bookings/queues/refund-execution.queue';
import { getRequestId } from '../../common/logging/request-context';
import { AuditLogService } from './audit-log.service';
import { ErrorCode } from '../../common/dto/error-response.dto';
import {
  CreateMarkupRuleDto,
  UpdateMarkupRuleDto,
} from '../dto/markup-rule.dto';
import { ListAuditLogsQueryDto } from '../dto/list-audit-logs-query.dto';
import { ListBookingsQueryDto } from '../dto/list-bookings-query.dto';
import { ListRefundsQueryDto } from '../dto/list-refunds-query.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { AuditLog } from '../entities/audit-log.entity';

/** Bookings stuck in `paid` longer than this show up in the health report. */
const STUCK_PAID_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    @InjectRepository(MarkupRule)
    private readonly markupRuleRepo: Repository<MarkupRule>,
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookEventRepo: Repository<PaymentWebhookEvent>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly duffelService: DuffelService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly refundExecutionService: RefundExecutionService,
    private readonly auditLogService: AuditLogService,
    @InjectQueue('payment_webhook_queue')
    private readonly paymentWebhookQueue: Queue,
    @InjectQueue('order_fulfillment_queue')
    private readonly orderFulfillmentQueue: Queue,
    @InjectQueue(REFUND_EXECUTION_QUEUE)
    private readonly refundExecutionQueue: Queue,
  ) {}

  // ── Users ───────────────────────────────────────────────────────

  async listUsers(query: ListUsersQueryDto): Promise<{
    users: Record<string, unknown>[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: FindOptionsWhere<User> = {};
    if (query.email) where.email = query.email;
    if (query.role) where.role = query.role;
    if (query.is_active !== undefined) where.isActive = query.is_active;

    const [users, total] = await this.userRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      users: users.map((u) => this.mapUser(u)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Activate/deactivate a user account. Deactivation also revokes all of the
   * user's refresh tokens, so the session ends at the next token refresh
   * (access tokens self-expire within their TTL).
   */
  async updateUser(
    adminUserId: string,
    userId: string,
    isActive: boolean,
  ): Promise<Record<string, unknown>> {
    if (userId === adminUserId && !isActive) {
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message: 'Admins cannot deactivate their own account.',
      });
    }

    const updated = await this.entityManager.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOneBy({ id: userId });
      if (!user) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'User not found.',
        });
      }

      user.isActive = isActive;
      const saved = await manager.save(User, user);

      if (!isActive) {
        await manager
          .getRepository(RefreshToken)
          .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      }

      await this.auditLogService.logAction(
        manager,
        adminUserId,
        'user.update',
        'user',
        userId,
        { is_active: isActive },
      );

      return saved;
    });

    this.logger.log(
      `Admin ${adminUserId} ${isActive ? 'activated' : 'deactivated'} user ${userId}`,
    );

    return this.mapUser(updated);
  }

  // ── Bookings ────────────────────────────────────────────────────

  async listBookings(query: ListBookingsQueryDto): Promise<{
    bookings: Record<string, unknown>[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: FindOptionsWhere<Booking> = {};
    if (query.status) where.status = query.status;
    if (query.user_id) where.userId = query.user_id;
    if (query.reference) where.bookingReference = query.reference;
    if (query.cancellation_requested)
      where.cancellationRequestedAt = Not(IsNull());

    const [bookings, total] = await this.bookingRepo.findAndCount({
      where,
      relations: { user: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    // Payment id/status ride along so the dashboard can offer the manual
    // refund action (POST /admin/payments/:id/refund) without extra calls.
    // Payments are unique per booking (ux_payments_booking_id).
    const payments = bookings.length
      ? await this.paymentRepo.findBy({
          bookingId: In(bookings.map((b) => b.id)),
        })
      : [];
    const paymentByBookingId = new Map(payments.map((p) => [p.bookingId, p]));

    return {
      bookings: bookings.map((b) => {
        const payment = paymentByBookingId.get(b.id);
        return {
          id: b.id,
          user_id: b.userId,
          user_email: b.user?.email ?? null,
          status: b.status,
          booking_reference: b.bookingReference,
          supplier_order_id: b.supplierOrderId,
          base_amount: b.baseAmount,
          markup_amount: b.markupAmount,
          total_amount: b.totalAmount,
          currency: b.currency,
          payment_id: payment?.id ?? null,
          payment_status: payment?.status ?? null,
          cancellation_requested_at: b.cancellationRequestedAt,
          cancellation_request_reason: b.cancellationRequestReason,
          created_at: b.createdAt,
          updated_at: b.updatedAt,
        };
      }),
      total,
      limit,
      offset,
    };
  }

  /**
   * T7 manual cancel for confirmed bookings that aren't auto-approvable.
   * Cancels the order at Duffel first (two-step quote + confirm), then
   * transitions the booking and writes the audit row in one transaction.
   */
  async cancelBooking(
    adminUserId: string,
    bookingId: string,
    reason?: string,
  ): Promise<Record<string, unknown>> {
    const booking = await this.bookingRepo.findOneBy({ id: bookingId });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Booking not found.',
      });
    }

    if (booking.status !== BookingStatus.Confirmed) {
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message: `Only confirmed bookings can be cancelled. Current status: ${booking.status}.`,
      });
    }

    // Cancel at the supplier first — if Duffel rejects or is unavailable,
    // the booking must stay confirmed.
    let supplierRefundAmount = 0;
    if (booking.supplierOrderId) {
      const result = await this.duffelService.cancelOrder(
        booking.supplierOrderId,
      );
      supplierRefundAmount = result.refundAmount;
    }

    const cancelReason = reason ?? 'admin_manual_cancel';

    // Same refund policy as customer self-cancel (prd.md §5.4): the customer
    // receives the supplier refund plus the full markup. The pending row
    // commits with the cancellation; the gateway call runs from the queue.
    const payment = await this.paymentRepo.findOneBy({ bookingId: booking.id });
    const customerReceivesAmount = supplierRefundAmount + booking.markupAmount;
    // Duffel is already cancelled at this point, so the cancellation must
    // commit no matter what — a payment that can't be refunded (missing or
    // in a non-refundable status) skips the refund row instead of throwing.
    const canRefund =
      payment !== null &&
      (payment.status === PaymentStatus.Succeeded ||
        payment.status === PaymentStatus.PartiallyRefunded) &&
      customerReceivesAmount > 0;
    if (payment && !canRefund) {
      this.logger.warn(
        `Booking ${booking.id} cancelled by admin but no refund was created (payment ${payment.id} status ${payment.status}, customer receives ${customerReceivesAmount}).`,
      );
    }

    const refund = await this.entityManager.transaction(async (manager) => {
      await this.stateMachine.transitionTo(
        manager,
        booking.id,
        BookingStatus.Cancelled,
        adminUserId,
        cancelReason,
      );

      let pendingRefund: Refund | null = null;
      if (payment && canRefund) {
        pendingRefund = await this.refundExecutionService.createPendingRefund(
          manager,
          {
            paymentId: payment.id,
            amount: customerReceivesAmount,
            reason: cancelReason,
            initiatedByUserId: adminUserId,
            supplierRefundAmount,
          },
        );
      }

      await this.auditLogService.logAction(
        manager,
        adminUserId,
        'booking.cancel',
        'booking',
        booking.id,
        {
          reason: cancelReason,
          supplier_order_id: booking.supplierOrderId,
          supplier_refund_amount: supplierRefundAmount,
          refund_id: pendingRefund?.id ?? null,
          customer_receives_amount: customerReceivesAmount,
        },
      );

      return pendingRefund;
    });

    if (refund) {
      await this.refundExecutionQueue.add(
        REFUND_EXECUTION_JOB,
        { refundId: refund.id, requestId: getRequestId() },
        refundExecutionJobOptions(refund.id),
      );
    }

    this.logger.log(
      `Admin ${adminUserId} cancelled booking ${booking.id} (supplier refund: ${supplierRefundAmount} ${booking.currency}, refund ${refund?.id ?? 'none'} queued)`,
    );

    return {
      id: booking.id,
      status: BookingStatus.Cancelled,
      supplier_refund_amount: supplierRefundAmount,
      customer_receives: {
        amount: customerReceivesAmount,
        currency: booking.currency,
      },
      refund: refund ? { id: refund.id, status: refund.status } : null,
      currency: booking.currency,
    };
  }

  // ── Payments ────────────────────────────────────────────────────

  /**
   * Manual refund through the payment gateway (Paymob). The pending Refund
   * row (+ audit log) commits first, then the gateway call executes inline —
   * the admin is present and wants immediate feedback. If Paymob rejects,
   * the row is marked `failed` (visible in GET /admin/refunds, retryable)
   * and the error propagates to the admin.
   */
  async refundPayment(
    adminUserId: string,
    paymentId: string,
    amount: number,
    reason?: string,
  ): Promise<Record<string, unknown>> {
    const payment = await this.paymentRepo.findOneBy({ id: paymentId });
    if (!payment) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Payment not found.',
      });
    }

    // Payment status and remaining-refundable validation happen inside
    // createPendingRefund, in the same transaction as the row itself.
    const refundReason = reason ?? 'admin_manual_refund';
    const pendingRefund = await this.entityManager.transaction(
      async (manager) => {
        const refund = await this.refundExecutionService.createPendingRefund(
          manager,
          {
            paymentId: payment.id,
            amount,
            reason: refundReason,
            initiatedByUserId: adminUserId,
          },
        );

        await this.auditLogService.logAction(
          manager,
          adminUserId,
          'payment.refund',
          'payment',
          payment.id,
          {
            refund_id: refund.id,
            amount,
            currency: payment.currency,
            reason: refundReason,
          },
        );

        return refund;
      },
    );

    let executed;
    try {
      executed = await this.refundExecutionService.executeRefund(
        pendingRefund.id,
      );
    } catch (err: unknown) {
      await this.refundExecutionService.markRefundFailed(
        pendingRefund.id,
        (err as Error).message,
      );
      throw err;
    }

    const { refund, fullyRefunded } = executed;

    this.logger.log(
      `Admin ${adminUserId} refunded ${amount} ${payment.currency} on payment ${payment.id} (provider refund ${refund.providerRefundId ?? 'n/a'})`,
    );

    return {
      id: refund.id,
      payment_id: payment.id,
      provider_refund_id: refund.providerRefundId,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      payment_status: fullyRefunded
        ? PaymentStatus.Refunded
        : PaymentStatus.PartiallyRefunded,
      fully_refunded: fullyRefunded,
    };
  }

  // ── Refunds ─────────────────────────────────────────────────────

  /** GET /admin/refunds?status=&limit=&offset= — refund pipeline monitor. */
  async listRefunds(query: ListRefundsQueryDto): Promise<{
    refunds: Record<string, unknown>[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: FindOptionsWhere<Refund> = {};
    if (query.status) where.status = query.status;

    const [refunds, total] = await this.refundRepo.findAndCount({
      where,
      relations: { payment: { booking: true } },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      refunds: refunds.map((r) => ({
        id: r.id,
        payment_id: r.paymentId,
        booking_id: r.payment?.bookingId ?? null,
        booking_reference: r.payment?.booking?.bookingReference ?? null,
        provider_refund_id: r.providerRefundId,
        amount: r.amount,
        currency: r.currency,
        supplier_refund_amount: r.supplierRefundAmount,
        status: r.status,
        reason: r.reason,
        initiated_by_user_id: r.initiatedByUserId,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * POST /admin/refunds/:id/retry — re-enqueues a failed (or stuck pending)
   * refund for gateway execution. Succeeded refunds cannot be retried.
   */
  async retryRefund(
    adminUserId: string,
    refundId: string,
  ): Promise<Record<string, unknown>> {
    const refund = await this.refundRepo.findOneBy({ id: refundId });
    if (!refund) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Refund not found.',
      });
    }
    if (refund.status === RefundStatus.Succeeded) {
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message: 'Refund already succeeded; nothing to retry.',
      });
    }

    // failed → pending so the executor picks it up again; a stuck pending
    // row is simply re-enqueued (the job is idempotent either way).
    if (refund.status === RefundStatus.Failed) {
      await this.refundRepo.update(
        { id: refund.id, status: RefundStatus.Failed },
        { status: RefundStatus.Pending },
      );
    }

    await this.auditLogService.logAction(
      this.entityManager,
      adminUserId,
      'refund.retry',
      'refund',
      refund.id,
      { previous_status: refund.status },
    );

    await this.refundExecutionQueue.add(
      REFUND_EXECUTION_JOB,
      { refundId: refund.id, requestId: getRequestId() },
      refundExecutionJobOptions(refund.id),
    );

    this.logger.log(
      `Admin ${adminUserId} retried refund ${refund.id} (was ${refund.status})`,
    );

    return { id: refund.id, status: RefundStatus.Pending };
  }

  // ── Markup rules ────────────────────────────────────────────────

  async listMarkupRules(): Promise<Record<string, unknown>[]> {
    const rules = await this.markupRuleRepo.find({
      order: { createdAt: 'DESC' },
    });
    return rules.map((r) => this.mapMarkupRule(r));
  }

  /**
   * Creates a markup rule. Activating it deactivates the previously active
   * rule inside the same transaction (the partial unique index on
   * is_active = true is the backstop).
   */
  async createMarkupRule(
    adminUserId: string,
    dto: CreateMarkupRuleDto,
  ): Promise<Record<string, unknown>> {
    this.validateMarkupValue(dto.type, dto.value);

    const saved = await this.entityManager.transaction(async (manager) => {
      if (dto.is_active) {
        await this.deactivateActiveRule(manager);
      }

      const rule = new MarkupRule();
      rule.type = dto.type;
      rule.value = String(dto.value);
      rule.isActive = dto.is_active ?? false;
      rule.createdByUserId = adminUserId;
      const created = await manager.save(MarkupRule, rule);

      await this.auditLogService.logAction(
        manager,
        adminUserId,
        'markup_rule.create',
        'markup_rule',
        created.id,
        { type: dto.type, value: dto.value, is_active: created.isActive },
      );

      return created;
    });

    return this.mapMarkupRule(saved);
  }

  async updateMarkupRule(
    adminUserId: string,
    ruleId: string,
    dto: UpdateMarkupRuleDto,
  ): Promise<Record<string, unknown>> {
    const saved = await this.entityManager.transaction(async (manager) => {
      const rule = await manager
        .getRepository(MarkupRule)
        .findOneBy({ id: ruleId });
      if (!rule) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Markup rule not found.',
        });
      }

      if (dto.value !== undefined) {
        this.validateMarkupValue(rule.type, dto.value);
        rule.value = String(dto.value);
      }

      if (dto.is_active === true && !rule.isActive) {
        await this.deactivateActiveRule(manager);
        rule.isActive = true;
      } else if (dto.is_active === false) {
        rule.isActive = false;
      }

      const updated = await manager.save(MarkupRule, rule);

      await this.auditLogService.logAction(
        manager,
        adminUserId,
        'markup_rule.update',
        'markup_rule',
        rule.id,
        { value: dto.value ?? null, is_active: dto.is_active ?? null },
      );

      return updated;
    });

    return this.mapMarkupRule(saved);
  }

  // ── Health ──────────────────────────────────────────────────────

  /**
   * Duffel operational dashboard: API auth status + hourly error rate,
   * webhook processing backlog, and bookings stuck in `paid`.
   */
  async getDuffelHealth(): Promise<Record<string, unknown>> {
    const metrics = await this.duffelService.getMetrics();

    const stuckCutoff = new Date(Date.now() - STUCK_PAID_WINDOW_MS);
    const stuckInPaid = await this.bookingRepo.countBy({
      status: BookingStatus.Paid,
      updatedAt: LessThan(stuckCutoff),
    });

    const unprocessedCount = await this.webhookEventRepo.countBy({
      processedAt: IsNull(),
    });
    const oldestUnprocessed = await this.webhookEventRepo.findOne({
      where: { processedAt: IsNull() },
      order: { receivedAt: 'ASC' },
    });
    const oldestAgeSeconds = oldestUnprocessed
      ? Math.round(
          (Date.now() - new Date(oldestUnprocessed.receivedAt).getTime()) /
            1000,
        )
      : 0;

    // DLQ depth (nfr.md §5/§7 — "DLQ depth is an admin-visible metric").
    const [paymentWebhookFailed, orderFulfillmentFailed] = await Promise.all([
      this.paymentWebhookQueue.getFailedCount(),
      this.orderFulfillmentQueue.getFailedCount(),
    ]);

    return {
      duffel: {
        configured: metrics.configured,
        requests_last_hour: metrics.requestsLastHour,
        errors_last_hour: metrics.errorsLastHour,
        recent_error_rate: metrics.recentErrorRate,
      },
      webhooks: {
        unprocessed_count: unprocessedCount,
        oldest_unprocessed_age_seconds: oldestAgeSeconds,
      },
      queues: {
        payment_webhook_queue: { failed: paymentWebhookFailed },
        order_fulfillment_queue: { failed: orderFulfillmentFailed },
      },
      bookings_stuck_in_paid: stuckInPaid,
    };
  }

  // ── Metrics ─────────────────────────────────────────────────────

  /**
   * GET /admin/metrics — the overview dashboard's numbers. Money figures
   * are grouped per currency (integer minor units, never summed across
   * currencies): charged = every payment that ever succeeded (succeeded /
   * partially_refunded / refunded all represent captured charges),
   * refunded = succeeded refunds only.
   */
  async getMetrics(): Promise<Record<string, unknown>> {
    const bookingsByStatusRaw: { status: string; count: string }[] =
      await this.bookingRepo
        .createQueryBuilder('b')
        .select('b.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('b.status')
        .getRawMany();
    const byStatus: Record<string, number> = {};
    let totalBookings = 0;
    for (const row of bookingsByStatusRaw) {
      const count = Number(row.count);
      byStatus[row.status] = count;
      totalBookings += count;
    }

    // Cancellation requests awaiting manual review: requested but the
    // booking is still confirmed (an actioned request leaves confirmed).
    const pendingCancellationRequests = await this.bookingRepo.count({
      where: {
        cancellationRequestedAt: Not(IsNull()),
        status: BookingStatus.Confirmed,
      },
    });

    const chargedRaw: { currency: string; charged: string }[] =
      await this.paymentRepo
        .createQueryBuilder('p')
        .select('p.currency', 'currency')
        .addSelect('COALESCE(SUM(p.amount), 0)', 'charged')
        .where('p.status IN (:...statuses)', {
          statuses: [
            PaymentStatus.Succeeded,
            PaymentStatus.PartiallyRefunded,
            PaymentStatus.Refunded,
          ],
        })
        .groupBy('p.currency')
        .getRawMany();

    const refundedRaw: { currency: string; refunded: string }[] =
      await this.refundRepo
        .createQueryBuilder('r')
        .select('r.currency', 'currency')
        .addSelect('COALESCE(SUM(r.amount), 0)', 'refunded')
        .where('r.status = :status', { status: RefundStatus.Succeeded })
        .groupBy('r.currency')
        .getRawMany();
    const refundedByCurrency = new Map(
      refundedRaw.map((r) => [r.currency, Number(r.refunded)]),
    );

    const payments = chargedRaw.map((row) => {
      const charged = Number(row.charged);
      const refunded = refundedByCurrency.get(row.currency) ?? 0;
      return {
        currency: row.currency,
        charged_amount: charged,
        refunded_amount: refunded,
        net_amount: charged - refunded,
      };
    });

    const [pendingRefunds, failedRefunds] = await Promise.all([
      this.refundRepo.countBy({ status: RefundStatus.Pending }),
      this.refundRepo.countBy({ status: RefundStatus.Failed }),
    ]);

    const [totalUsers, activeUsers] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.countBy({ isActive: true }),
    ]);

    return {
      bookings: {
        total: totalBookings,
        by_status: byStatus,
        pending_cancellation_requests: pendingCancellationRequests,
      },
      payments,
      refunds: {
        pending_count: pendingRefunds,
        failed_count: failedRefunds,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
      },
    };
  }

  // ── Audit logs ──────────────────────────────────────────────────

  /** GET /admin/audit-logs — read side of the audit trail (writes are in AuditLogService). */
  async listAuditLogs(query: ListAuditLogsQueryDto): Promise<{
    audit_logs: Record<string, unknown>[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: FindOptionsWhere<AuditLog> = {};
    if (query.entity_type) where.entityType = query.entity_type;
    if (query.entity_id) where.entityId = query.entity_id;
    if (query.action) where.action = query.action;
    if (query.actor_user_id) where.actorUserId = query.actor_user_id;

    const [logs, total] = await this.auditLogRepo.findAndCount({
      where,
      relations: { actorUser: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      audit_logs: logs.map((log) => ({
        id: log.id,
        actor_user_id: log.actorUserId,
        actor_email: log.actorUser?.email ?? null,
        action: log.action,
        entity_type: log.entityType,
        entity_id: log.entityId,
        metadata: log.metadata,
        created_at: log.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  // ── Internals ───────────────────────────────────────────────────

  private async deactivateActiveRule(manager: EntityManager): Promise<void> {
    await manager
      .getRepository(MarkupRule)
      .update({ isActive: true }, { isActive: false });
  }

  private validateMarkupValue(type: MarkupType, value: number): void {
    if (type === MarkupType.Percentage && value > 100) {
      throw new UnprocessableEntityException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Percentage markup cannot exceed 100.',
      });
    }
  }

  private mapUser(user: User): Record<string, unknown> {
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      phone: user.phone,
      role: user.role,
      is_active: user.isActive,
      email_verified_at: user.emailVerifiedAt,
      created_at: user.createdAt,
    };
  }

  private mapMarkupRule(rule: MarkupRule): Record<string, unknown> {
    return {
      id: rule.id,
      type: rule.type,
      value: parseFloat(rule.value),
      is_active: rule.isActive,
      created_by_user_id: rule.createdByUserId,
      created_at: rule.createdAt,
      updated_at: rule.updatedAt,
    };
  }
}
