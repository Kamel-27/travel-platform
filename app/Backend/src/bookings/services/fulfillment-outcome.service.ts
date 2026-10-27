import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { EntityManager } from 'typeorm';

import type { DuffelOrderResult } from '../../duffel/duffel.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { RefundExecutionService } from './refund-execution.service';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { Document } from '../entities/document.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import { Passenger } from '../entities/passenger.entity';
import { User } from '../../users/user.entity';
import { TicketPdfService } from './ticket-pdf.service';
import { MailService } from '../../auth/services/mail.service';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { Refund } from '../../payments/entities/refund.entity';
import { LedgerService } from '../../ledger/services/ledger.service';
import { LedgerEntryType } from '../../ledger/entities/ledger-entry.entity';
import {
  REFUND_EXECUTION_JOB,
  REFUND_EXECUTION_QUEUE,
  refundExecutionJobOptions,
} from '../queues/refund-execution.queue';
import { getRequestId } from '../../common/logging/request-context';

/**
 * The two ways a `paid` booking can leave `paid` — T5 (confirmed) and
 * T6 (order_failed + refund) — applied identically no matter which path got
 * there first: the synchronous createOrder call, the `order.created` webhook,
 * or the reconciliation sweep.
 *
 * Both re-read the booking under a row lock and act only while it is still
 * `paid`, so racing paths apply each outcome exactly once — one supplier
 * charge, one set of documents, one refund.
 */
@Injectable()
export class FulfillmentOutcomeService {
  private readonly logger = new Logger(FulfillmentOutcomeService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly stateMachine: BookingStateMachineService,
    private readonly ledgerService: LedgerService,
    private readonly refundExecutionService: RefundExecutionService,
    private readonly ticketPdfService: TicketPdfService,
    private readonly mailService: MailService,
    @InjectQueue(REFUND_EXECUTION_QUEUE)
    private readonly refundExecutionQueue: Queue,
  ) {}

  /**
   * T5: paid → confirmed. Runs inside the caller's transaction (the webhook
   * processor commits its event row alongside it). Returns false when the
   * booking was no longer `paid` — a replay, nothing written. On true, the
   * caller sends sendConfirmationEmail() AFTER its transaction commits.
   */
  async confirmPaidBooking(
    manager: EntityManager,
    bookingId: string,
    order: DuffelOrderResult,
    reason: string,
  ): Promise<boolean> {
    const booking = await this.lockBooking(manager, bookingId);
    if (!booking || booking.status !== BookingStatus.Paid) {
      this.logger.debug(
        `Booking ${bookingId} is ${booking?.status ?? 'missing'}, not paid — confirmation skipped (replay).`,
      );
      return false;
    }

    await manager.getRepository(Booking).update(booking.id, {
      supplierOrderId: order.orderId,
      bookingReference: order.bookingReference,
    });

    await this.stateMachine.transitionTo(
      manager,
      booking.id,
      BookingStatus.Confirmed,
      null,
      reason,
    );

    await this.ledgerService.createEntry(manager, {
      entryType: LedgerEntryType.SupplierCharge,
      amount: -booking.baseAmount,
      currency: booking.currency,
      supplier: booking.supplier,
      bookingId: booking.id,
      note: `Duffel order ${order.orderId}`,
    });

    for (const doc of order.documents) {
      const document = new Document();
      document.bookingId = booking.id;
      document.type = doc.type;
      document.uniqueIdentifier = doc.uniqueIdentifier;
      document.supplierPassengerIds = doc.passengerIds;
      await manager.save(Document, document);
    }

    this.logger.log(
      `Booking ${booking.id} → confirmed (order ${order.orderId}, PNR ${order.bookingReference}) — ${reason}`,
    );
    return true;
  }

  /**
   * T6: paid → order_failed, plus a pending refund of the full amount that is
   * enqueued for execution once the transaction commits (PRD §5.3). Returns
   * false when the booking was no longer `paid`.
   */
  async failPaidBookingAndRefund(
    bookingId: string,
    transitionReason: string,
    refundReason: string,
  ): Promise<boolean> {
    const outcome = await this.entityManager.transaction(async (manager) => {
      const booking = await this.lockBooking(manager, bookingId);
      if (!booking || booking.status !== BookingStatus.Paid) {
        return { applied: false, refund: null };
      }

      await this.stateMachine.transitionTo(
        manager,
        booking.id,
        BookingStatus.OrderFailed,
        null,
        transitionReason,
      );

      const refund = await this.createFullRefund(
        manager,
        booking,
        refundReason,
      );
      return { applied: true, refund };
    });

    if (!outcome.applied) {
      this.logger.debug(
        `Booking ${bookingId} is no longer paid — failure/refund skipped (replay).`,
      );
      return false;
    }

    if (outcome.refund) {
      await this.enqueueRefund(outcome.refund.id);
    }
    this.logger.warn(
      `Booking ${bookingId} → order_failed: ${transitionReason}`,
    );
    return true;
  }

  /**
   * Renders the e-ticket PDF for a freshly confirmed booking and emails it to
   * the account holder. Best-effort: logs and swallows every error — the
   * booking is already confirmed and committed, and the ticket stays
   * downloadable from the booking page regardless.
   */
  async sendConfirmationEmail(bookingId: string): Promise<void> {
    try {
      const booking = await this.entityManager
        .getRepository(Booking)
        .findOneBy({ id: bookingId });
      if (!booking) return;

      const [user, snapshot, passengers, documents] = await Promise.all([
        this.entityManager
          .getRepository(User)
          .findOneBy({ id: booking.userId }),
        this.entityManager.getRepository(FlightOfferSnapshot).findOne({
          where: { bookingId },
          relations: { slices: { segments: true } },
        }),
        this.entityManager
          .getRepository(Passenger)
          .find({ where: { bookingId } }),
        this.entityManager
          .getRepository(Document)
          .find({ where: { bookingId } }),
      ]);

      if (!user?.email) {
        this.logger.warn(
          `No account email for booking ${bookingId}; skipping confirmation email.`,
        );
        return;
      }

      const pdf = await this.ticketPdfService.generate(
        booking,
        snapshot,
        passengers,
        documents,
      );

      await this.mailService.sendBookingConfirmation(user.email, booking, pdf);
      this.logger.log(
        `Confirmation email dispatched for booking ${bookingId} → ${user.email}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to send confirmation email for booking ${bookingId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Hands a pending refund to refund_execution_queue. The jobId is derived
   * from the refund, so enqueueing one that already has a live job is a
   * no-op. A Redis failure is logged, not thrown — the refund row is already
   * committed and RefundRequeueSweepService picks it up.
   */
  async enqueueRefund(refundId: string): Promise<void> {
    try {
      await this.refundExecutionQueue.add(
        REFUND_EXECUTION_JOB,
        { refundId, requestId: getRequestId() },
        refundExecutionJobOptions(refundId),
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to enqueue refund ${refundId}; the requeue sweep will retry`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async createFullRefund(
    manager: EntityManager,
    booking: Booking,
    reason: string,
  ): Promise<Refund | null> {
    const payment = await manager
      .getRepository(Payment)
      .findOneBy({ bookingId: booking.id });

    if (
      !payment ||
      (payment.status !== PaymentStatus.Succeeded &&
        payment.status !== PaymentStatus.PartiallyRefunded)
    ) {
      this.logger.error(
        `Booking ${booking.id} failed but its payment is ${payment?.status ?? 'missing'} — no automatic refund; needs manual review.`,
      );
      return null;
    }

    try {
      return await this.refundExecutionService.createPendingRefund(manager, {
        paymentId: payment.id,
        amount: booking.totalAmount,
        reason,
        initiatedByUserId: null,
      });
    } catch (err: unknown) {
      // Validation-only failures (e.g. already partially refunded) — keep
      // the order_failed transition and leave the refund to an admin.
      this.logger.error(
        `Automatic refund for booking ${booking.id} could not be created; needs manual review`,
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }

  private lockBooking(
    manager: EntityManager,
    bookingId: string,
  ): Promise<Booking | null> {
    return manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .setLock('pessimistic_write')
      .where('booking.id = :id', { id: bookingId })
      .getOne();
  }
}
