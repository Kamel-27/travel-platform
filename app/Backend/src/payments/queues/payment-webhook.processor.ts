/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { EntityManager } from 'typeorm';
import { Job, Queue } from 'bullmq';
import { randomUUID } from 'crypto';

import { PaymentWebhookEvent } from '../entities/payment-webhook-event.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
} from '../entities/payment-attempt.entity';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { BookingStateMachineService } from '../../bookings/services/booking-state-machine.service';
import { toPaymobGatewayAmount } from '../services/paymob.service';
import {
  getRequestId,
  runWithRequestId,
} from '../../common/logging/request-context';

@Processor('payment_webhook_queue')
export class PaymentWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentWebhookProcessor.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly stateMachine: BookingStateMachineService,
    @InjectQueue('order_fulfillment_queue')
    private readonly orderFulfillmentQueue: Queue,
  ) {
    super();
  }

  async process(
    job: Job<{ eventId: string; requestId?: string }>,
  ): Promise<void> {
    // Correlate worker logs back to the inbound webhook call (nfr.md §7) —
    // falls back to a fresh id for jobs re-enqueued by the reprocessing sweep,
    // which has no originating request.
    return runWithRequestId(job.data.requestId ?? randomUUID(), () =>
      this.processEvent(job),
    );
  }

  private async processEvent(job: Job<{ eventId: string }>): Promise<void> {
    const { eventId } = job.data;
    this.logger.log(`Processing paymob webhook job for event: ${eventId}`);

    // The transaction below returns the booking id to enqueue for order
    // fulfillment (or null) — the actual enqueue happens after it commits
    // (see comment further down): enqueuing from inside the transaction is a
    // race, since the fulfillment job can be picked up and read the
    // booking's status before this transaction's "paid" write is visible to
    // other connections.
    const bookingIdToFulfill = await this.entityManager.transaction<
      string | null
    >(async (manager) => {
      const webhookEvent = await manager
        .getRepository(PaymentWebhookEvent)
        .createQueryBuilder('event')
        .setLock('pessimistic_write')
        .where('event.id = :id', { id: eventId })
        .getOne();

      if (!webhookEvent) {
        this.logger.error(`Webhook event ${eventId} not found in database.`);
        return null;
      }

      // Idempotency: skip if already processed
      if (webhookEvent.processedAt) {
        this.logger.debug(
          `Webhook event ${eventId} already processed. Skipping.`,
        );
        return null;
      }

      const transaction = webhookEvent.payload.obj;
      if (!transaction) {
        this.logger.warn(
          `Paymob event ${eventId} payload does not contain obj.`,
        );
        webhookEvent.processedAt = new Date();
        await manager.save(PaymentWebhookEvent, webhookEvent);
        return null;
      }

      // Pending (e.g. 3DS in flight) carries no final outcome — ack and wait
      // for the terminal callback.
      if (webhookEvent.eventType === 'transaction.pending') {
        webhookEvent.processedAt = new Date();
        await manager.save(PaymentWebhookEvent, webhookEvent);
        return null;
      }

      // Attempts are keyed by the Paymob order id (obj.order.id)
      const paymobOrderId =
        transaction.order?.id !== undefined
          ? String(transaction.order.id)
          : null;

      if (!paymobOrderId) {
        this.logger.warn(
          `Paymob event ${eventId} transaction carries no order id.`,
        );
        webhookEvent.processedAt = new Date();
        await manager.save(PaymentWebhookEvent, webhookEvent);
        return null;
      }

      // 1. Resolve Attempt
      const attempt = await manager.getRepository(PaymentAttempt).findOne({
        where: { providerReferenceId: paymobOrderId },
      });

      if (!attempt) {
        // Race condition: webhook arrived before backend finished creating attempt.
        // Throw error so BullMQ retries the job.
        this.logger.warn(
          `PaymentAttempt with reference ${paymobOrderId} not found yet. Retrying job.`,
        );
        throw new Error(
          `Attempt reference ${paymobOrderId} not found, retry scheduled.`,
        );
      }

      // 2. Resolve Payment & Booking
      const payment = await manager
        .getRepository(Payment)
        .findOneBy({ id: attempt.paymentId });
      if (!payment) {
        this.logger.error(`Associated Payment ${attempt.paymentId} not found.`);
        return null;
      }

      const booking = await manager
        .getRepository(Booking)
        .createQueryBuilder('booking')
        .setLock('pessimistic_write')
        .where('booking.id = :id', { id: payment.bookingId })
        .getOne();

      if (!booking) {
        this.logger.error(`Associated Booking ${payment.bookingId} not found.`);
        return null;
      }

      // Link event columns
      webhookEvent.paymentId = payment.id;
      webhookEvent.paymentAttemptId = attempt.id;

      let fulfillBookingId: string | null = null;

      // 3. Process outcomes
      if (webhookEvent.eventType === 'transaction.succeeded') {
        const paidAmount = transaction.amount_cents as number;
        // The gateway order was registered with the sandbox-converted EGP
        // amount, so the webhook must be verified against that same figure.
        const expectedAmount = toPaymobGatewayAmount(
          booking.totalAmount,
          booking.currency,
        ).amountCents;

        if (paidAmount !== expectedAmount) {
          this.logger.error(
            `Paymob payment amount mismatch. Event has ${paidAmount}, Booking expects ${expectedAmount} (original: ${booking.totalAmount} ${booking.currency}).`,
          );
          throw new Error('Paymob payment amount mismatch');
        }

        // T4 transition: awaiting_payment -> paid
        await this.stateMachine.transitionTo(
          manager,
          booking.id,
          BookingStatus.Paid,
          null, // system transition
          'Paymob transaction succeeded',
        );

        // Update payment and attempt statuses
        attempt.status = PaymentAttemptStatus.Succeeded;
        payment.status = PaymentStatus.Succeeded;

        await manager.save(PaymentAttempt, attempt);
        await manager.save(Payment, payment);

        fulfillBookingId = booking.id;
      } else if (webhookEvent.eventType === 'transaction.failed') {
        attempt.status = PaymentAttemptStatus.Failed;
        attempt.failureReason =
          transaction.data?.message || 'Transaction declined';

        await manager.save(PaymentAttempt, attempt);
        // Note: Booking stays awaiting_payment to allow retry
      }

      // 4. Mark processed
      webhookEvent.processedAt = new Date();
      await manager.save(PaymentWebhookEvent, webhookEvent);
      this.logger.log(
        `Successfully processed paymob webhook event: ${eventId}`,
      );

      return fulfillBookingId;
    });

    // Enqueue Duffel order creation job now that the "paid" transition above
    // is committed (no auto-retries — ambiguous failures must stay in paid
    // and be handled by reconciliation sweep).
    if (bookingIdToFulfill) {
      await this.orderFulfillmentQueue.add(
        'create_duffel_order',
        { bookingId: bookingIdToFulfill, requestId: getRequestId() },
        { attempts: 1, removeOnComplete: true, removeOnFail: 100 },
      );
      this.logger.log(
        `Booking ${bookingIdToFulfill} payment verified. Order creation job enqueued.`,
      );
    }
  }
}
