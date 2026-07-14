import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';

import {
  PaymobService,
  toPaymobGatewayAmount,
} from '../../payments/services/paymob.service';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { Refund, RefundStatus } from '../../payments/entities/refund.entity';
import { PaymentWebhookEvent } from '../../payments/entities/payment-webhook-event.entity';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { BookingStateMachineService } from './booking-state-machine.service';
import { ErrorCode } from '../../common/dto/error-response.dto';

export interface CreatePendingRefundParams {
  paymentId: string;
  amount: number;
  reason: string | null;
  initiatedByUserId: string | null;
  supplierRefundAmount?: number | null;
}

export interface ExecuteRefundResult {
  refund: Refund;
  /** false when the row was not pending (already executed/failed) — a no-op replay. */
  executed: boolean;
  fullyRefunded: boolean;
}

/**
 * Refund pipeline shared by AdminService (manual refund, admin cancel) and
 * BookingsService (customer self-cancel, T7).
 *
 * Refunds are two-phase: a `pending` Refund row is written INSIDE the
 * caller's cancel/refund transaction (so the obligation to refund commits
 * atomically with the state change), and the Paymob gateway call happens
 * afterwards — inline for manual admin refunds, or from the
 * refund_execution_queue job for cancellations — via executeRefund(), which
 * is idempotent and safe to retry. A row whose gateway call ultimately fails
 * is marked `failed` and surfaces in GET /admin/refunds for manual retry.
 */
@Injectable()
export class RefundExecutionService {
  private readonly logger = new Logger(RefundExecutionService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookEventRepo: Repository<PaymentWebhookEvent>,
    private readonly paymobService: PaymobService,
    private readonly stateMachine: BookingStateMachineService,
  ) {}

  /**
   * Writes a `pending` Refund row. Must run inside the caller's transaction,
   * alongside the booking state transition that justifies the refund.
   * Validates the amount against the remaining refundable balance, counting
   * BOTH pending and succeeded rows so queued-but-unexecuted refunds can't
   * be double-committed.
   */
  async createPendingRefund(
    manager: EntityManager,
    params: CreatePendingRefundParams,
  ): Promise<Refund> {
    const payment = await manager
      .getRepository(Payment)
      .findOneBy({ id: params.paymentId });
    if (!payment) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Payment not found.',
      });
    }

    if (
      payment.status !== PaymentStatus.Succeeded &&
      payment.status !== PaymentStatus.PartiallyRefunded
    ) {
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message: `Payment in status ${payment.status} cannot be refunded.`,
      });
    }

    if (params.amount <= 0) {
      throw new UnprocessableEntityException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Refund amount must be a positive integer.',
      });
    }

    const committed = await this.sumCommittedRefunds(manager, payment.id);
    if (committed + params.amount > payment.amount) {
      throw new UnprocessableEntityException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Refund of ${params.amount} exceeds the remaining refundable amount (${payment.amount - committed}).`,
      });
    }

    const refund = new Refund();
    refund.paymentId = payment.id;
    refund.providerRefundId = null;
    refund.amount = params.amount;
    refund.currency = payment.currency;
    refund.status = RefundStatus.Pending;
    refund.reason = params.reason;
    refund.initiatedByUserId = params.initiatedByUserId;
    refund.supplierRefundAmount = params.supplierRefundAmount ?? null;
    const saved = await manager.save(Refund, refund);

    this.logger.log(
      `Created pending refund ${saved.id} (${params.amount} ${payment.currency}) on payment ${payment.id}`,
    );
    return saved;
  }

  /**
   * Executes a pending refund at the Paymob gateway, then records the
   * result: row → succeeded, Payment status rollup, and booking →
   * refunded when the payment is fully covered from cancelled/order_failed.
   *
   * Idempotent: a row that is not `pending` is a no-op (executed: false),
   * so BullMQ retries and manual admin retries can never double-refund.
   * The gateway call happens OUTSIDE any DB transaction (house rule).
   */
  async executeRefund(refundId: string): Promise<ExecuteRefundResult> {
    const refund = await this.refundRepo.findOneBy({ id: refundId });
    if (!refund) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Refund not found.',
      });
    }

    if (refund.status !== RefundStatus.Pending) {
      this.logger.log(
        `Refund ${refund.id} is ${refund.status}, not pending — skipping execution (idempotent replay).`,
      );
      return { refund, executed: false, fullyRefunded: false };
    }

    const payment = await this.paymentRepo.findOneBy({
      id: refund.paymentId,
    });
    if (!payment) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Payment not found for refund.',
      });
    }

    const transactionId = await this.resolvePaymobTransactionId(payment.id);
    // The original gateway charge was sandbox-converted to EGP, so refunds
    // must be issued in the same converted figure.
    const { amountCents: gatewayAmount } = toPaymobGatewayAmount(
      refund.amount,
      refund.currency,
    );
    const { refundId: providerRefundId } =
      await this.paymobService.refundTransaction(transactionId, gatewayAmount);

    const { updatedRefund, fullyRefunded } =
      await this.refundRepo.manager.transaction(async (manager) => {
        // Re-read under lock — another executor may have finished it while
        // the gateway call was in flight.
        const row = await manager
          .getRepository(Refund)
          .createQueryBuilder('refund')
          .setLock('pessimistic_write')
          .where('refund.id = :id', { id: refund.id })
          .getOne();
        if (!row || row.status !== RefundStatus.Pending) {
          this.logger.warn(
            `Refund ${refund.id} changed state during gateway execution — recording skipped (provider refund ${providerRefundId} already issued).`,
          );
          return { updatedRefund: row ?? refund, fullyRefunded: false };
        }

        row.providerRefundId = providerRefundId;
        row.status = RefundStatus.Succeeded;
        const savedRefund = await manager.save(Refund, row);

        const priorSucceeded = await manager.getRepository(Refund).findBy({
          paymentId: payment.id,
          status: RefundStatus.Succeeded,
        });
        const refundedTotal = priorSucceeded.reduce(
          (sum, r) => sum + r.amount,
          0,
        );
        const isFullyRefunded = refundedTotal >= payment.amount;

        payment.status = isFullyRefunded
          ? PaymentStatus.Refunded
          : PaymentStatus.PartiallyRefunded;
        await manager.save(Payment, payment);

        if (isFullyRefunded) {
          const booking = await manager
            .getRepository(Booking)
            .findOneBy({ id: payment.bookingId });
          if (
            booking &&
            (booking.status === BookingStatus.Cancelled ||
              booking.status === BookingStatus.OrderFailed)
          ) {
            await this.stateMachine.transitionTo(
              manager,
              booking.id,
              BookingStatus.Refunded,
              savedRefund.initiatedByUserId,
              savedRefund.reason,
            );
          }
        }

        return { updatedRefund: savedRefund, fullyRefunded: isFullyRefunded };
      });

    this.logger.log(
      `Executed refund ${updatedRefund.id} (${refund.amount} ${refund.currency}) on payment ${payment.id} — provider refund ${providerRefundId}, fullyRefunded=${fullyRefunded}`,
    );

    return { refund: updatedRefund, executed: true, fullyRefunded };
  }

  /**
   * Marks a pending refund as failed (terminal until an admin retries it via
   * POST /admin/refunds/:id/retry). No-op unless the row is still pending.
   */
  async markRefundFailed(refundId: string, reason: string): Promise<void> {
    const result = await this.refundRepo.update(
      { id: refundId, status: RefundStatus.Pending },
      { status: RefundStatus.Failed },
    );
    if (result.affected) {
      this.logger.error(
        `Refund ${refundId} marked failed after exhausting retries: ${reason}`,
      );
    }
  }

  async sumSucceededRefunds(paymentId: string): Promise<number> {
    const refunds = await this.refundRepo.findBy({
      paymentId,
      status: RefundStatus.Succeeded,
    });
    return refunds.reduce((sum, r) => sum + r.amount, 0);
  }

  /** Pending + succeeded — the amount already spoken for on this payment. */
  private async sumCommittedRefunds(
    manager: EntityManager,
    paymentId: string,
  ): Promise<number> {
    const refunds = await manager.getRepository(Refund).findBy({
      paymentId,
      status: In([RefundStatus.Pending, RefundStatus.Succeeded]),
    });
    return refunds.reduce((sum, r) => sum + r.amount, 0);
  }

  /**
   * The Paymob refund API needs the transaction id (webhook payload obj.id).
   * Attempts only store the Paymob order id, so it is read back from the
   * stored `transaction.succeeded` webhook event.
   */
  private async resolvePaymobTransactionId(paymentId: string): Promise<number> {
    const event = await this.webhookEventRepo.findOne({
      where: { paymentId, eventType: 'transaction.succeeded' },
      order: { receivedAt: 'DESC' },
    });

    const payload = event?.payload as { obj?: { id?: unknown } } | undefined;
    const rawId: unknown = payload?.obj?.id;
    const transactionId = typeof rawId === 'number' ? rawId : Number(rawId);

    if (!rawId || Number.isNaN(transactionId)) {
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message:
          'No succeeded gateway transaction found for this payment; cannot refund.',
      });
    }

    return transactionId;
  }
}
