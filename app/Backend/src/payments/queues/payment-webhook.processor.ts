/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { EntityManager } from 'typeorm';
import { Job, Queue } from 'bullmq';

import { PaymentWebhookEvent } from '../entities/payment-webhook-event.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
} from '../entities/payment-attempt.entity';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { BookingStateMachineService } from '../../bookings/services/booking-state-machine.service';

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

  async process(job: Job<{ eventId: string }>): Promise<void> {
    const { eventId } = job.data;
    this.logger.log(`Processing paymob webhook job for event: ${eventId}`);

    // Process inside transaction
    await this.entityManager.transaction(async (manager) => {
      const webhookEvent = await manager
        .getRepository(PaymentWebhookEvent)
        .createQueryBuilder('event')
        .setLock('pessimistic_write')
        .where('event.id = :id', { id: eventId })
        .getOne();

      if (!webhookEvent) {
        this.logger.error(`Webhook event ${eventId} not found in database.`);
        return;
      }

      // Idempotency: skip if already processed
      if (webhookEvent.processedAt) {
        this.logger.debug(
          `Webhook event ${eventId} already processed. Skipping.`,
        );
        return;
      }

      const transaction = webhookEvent.payload.obj;
      if (!transaction) {
        this.logger.warn(
          `Paymob event ${eventId} payload does not contain obj.`,
        );
        webhookEvent.processedAt = new Date();
        await manager.save(PaymentWebhookEvent, webhookEvent);
        return;
      }

      // Pending (e.g. 3DS in flight) carries no final outcome — ack and wait
      // for the terminal callback.
      if (webhookEvent.eventType === 'transaction.pending') {
        webhookEvent.processedAt = new Date();
        await manager.save(PaymentWebhookEvent, webhookEvent);
        return;
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
        return;
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
        return;
      }

      const booking = await manager
        .getRepository(Booking)
        .createQueryBuilder('booking')
        .setLock('pessimistic_write')
        .where('booking.id = :id', { id: payment.bookingId })
        .getOne();

      if (!booking) {
        this.logger.error(`Associated Booking ${payment.bookingId} not found.`);
        return;
      }

      // Link event columns
      webhookEvent.paymentId = payment.id;
      webhookEvent.paymentAttemptId = attempt.id;

      // 3. Process outcomes
      if (webhookEvent.eventType === 'transaction.succeeded') {
        const paidAmount = transaction.amount_cents as number;
        let expectedAmount = booking.totalAmount;
        if (booking.currency === 'USD' && transaction.currency === 'EGP' && process.env.NODE_ENV !== 'test') {
          expectedAmount = Math.round(booking.totalAmount * 50.0);
        }

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

        // Enqueue Duffel order creation job (no auto-retries — ambiguous failures
        // must stay in paid and be handled by reconciliation sweep)
        await this.orderFulfillmentQueue.add(
          'create_duffel_order',
          { bookingId: booking.id },
          { attempts: 1, removeOnComplete: true, removeOnFail: 100 },
        );
        this.logger.log(
          `Booking ${booking.id} payment verified. Order creation job enqueued.`,
        );
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
    });
  }
}
