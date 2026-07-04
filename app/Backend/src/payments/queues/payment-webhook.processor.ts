/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Job } from 'bullmq';

import { PaymentWebhookEvent } from '../entities/payment-webhook-event.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
} from '../entities/payment-attempt.entity';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { BookingStateMachineService } from '../../bookings/services/booking-state-machine.service';

@Processor('stripe_webhook_queue')
export class PaymentWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentWebhookProcessor.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly stateMachine: BookingStateMachineService,
  ) {
    super();
  }

  async process(job: Job<{ eventId: string }>): Promise<void> {
    const { eventId } = job.data;
    this.logger.log(`Processing stripe webhook job for event: ${eventId}`);

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

      const stripeEventObj = webhookEvent.payload;
      const intentObj = stripeEventObj.data?.object;
      if (!intentObj) {
        this.logger.warn(
          `Stripe event ${eventId} payload does not contain data.object.`,
        );
        webhookEvent.processedAt = new Date();
        await manager.save(PaymentWebhookEvent, webhookEvent);
        return;
      }

      const intentId = intentObj.id;

      // 1. Resolve Attempt
      const attempt = await manager.getRepository(PaymentAttempt).findOne({
        where: { providerReferenceId: intentId },
      });

      if (!attempt) {
        // Race condition: webhook arrived before backend finished creating attempt.
        // Throw error so BullMQ retries the job.
        this.logger.warn(
          `PaymentAttempt with reference ${intentId} not found yet. Retrying job.`,
        );
        throw new Error(
          `Attempt reference ${intentId} not found, retry scheduled.`,
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
      if (webhookEvent.eventType === 'payment_intent.succeeded') {
        const stripeAmount = intentObj.amount as number;
        if (stripeAmount !== booking.totalAmount) {
          this.logger.error(
            `Stripe payment amount mismatch. Event has ${stripeAmount}, Booking expects ${booking.totalAmount}.`,
          );
          throw new Error('Stripe payment amount mismatch');
        }

        // T4 transition: awaiting_payment -> paid
        await this.stateMachine.transitionTo(
          manager,
          booking.id,
          BookingStatus.Paid,
          null, // system transition
          'Stripe payment intent succeeded',
        );

        // Update payment and attempt statuses
        attempt.status = PaymentAttemptStatus.Succeeded;
        payment.status = PaymentStatus.Succeeded;

        await manager.save(PaymentAttempt, attempt);
        await manager.save(Payment, payment);

        // Stub: Enqueue order-creation job (Branch 3 will implement the actual queue worker)
        this.logger.log(
          `Booking ${booking.id} payment verified. Enqueuing order creation (stub).`,
        );
      } else if (webhookEvent.eventType === 'payment_intent.payment_failed') {
        attempt.status = PaymentAttemptStatus.Failed;
        attempt.failureReason =
          intentObj.last_payment_error?.message || 'Payment method declined';

        await manager.save(PaymentAttempt, attempt);
        // Note: Booking stays awaiting_payment to allow retry
      }

      // 4. Mark processed
      webhookEvent.processedAt = new Date();
      await manager.save(PaymentWebhookEvent, webhookEvent);
      this.logger.log(
        `Successfully processed stripe webhook event: ${eventId}`,
      );
    });
  }
}
