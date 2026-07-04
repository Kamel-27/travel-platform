/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Job } from 'bullmq';

import { SupplierWebhookEvent } from '../entities/supplier-webhook-event.entity';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import { Segment } from '../entities/segment.entity';
import { User } from '../../users/user.entity';
import { DuffelService } from '../../duffel/duffel.service';
import { DuffelReconciliationService } from '../services/duffel-reconciliation.service';
import { MailService } from '../../auth/services/mail.service';

/**
 * Processes queued Duffel order-lifecycle webhooks (order.created,
 * order.airline_initiated_change_detected, ping.triggered).
 *
 * Unmatched/failed events are left with processed_at = NULL and picked up
 * by DuffelWebhookSweepService — this worker never throws to trigger a
 * BullMQ retry (no retry policy is configured on this queue, matching the
 * payment_webhook_queue convention).
 */
@Processor('duffel_webhook_queue')
export class DuffelWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(DuffelWebhookProcessor.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly duffelService: DuffelService,
    private readonly reconciliation: DuffelReconciliationService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async process(job: Job<{ eventId: string }>): Promise<void> {
    const { eventId } = job.data;

    await this.entityManager.transaction(async (manager) => {
      const webhookEvent = await manager
        .getRepository(SupplierWebhookEvent)
        .createQueryBuilder('event')
        .setLock('pessimistic_write')
        .where('event.id = :id', { id: eventId })
        .getOne();

      if (!webhookEvent) {
        this.logger.error(`Supplier webhook event ${eventId} not found.`);
        return;
      }
      if (webhookEvent.processedAt) {
        this.logger.debug(`Event ${eventId} already processed. Skipping.`);
        return;
      }

      const resolved = await this.handleEvent(manager, webhookEvent);
      if (!resolved) {
        // Leave processed_at null — DuffelWebhookSweepService retries later.
        this.logger.warn(
          `Event ${eventId} (${webhookEvent.eventType}) not resolvable yet; left for reprocessing.`,
        );
        return;
      }

      webhookEvent.bookingId = resolved.bookingId;
      webhookEvent.processedAt = new Date();
      await manager.save(SupplierWebhookEvent, webhookEvent);
    });
  }

  /** Returns null when the event couldn't be resolved yet (retry later). */
  private async handleEvent(
    manager: EntityManager,
    event: SupplierWebhookEvent,
  ): Promise<{ bookingId: string | null } | null> {
    switch (event.eventType) {
      case 'ping.triggered':
        return { bookingId: null };

      case 'order.created':
        return this.handleOrderCreated(manager, event);

      case 'order.airline_initiated_change_detected':
        return this.handleScheduleChange(manager, event);

      default:
        this.logger.warn(`Unhandled Duffel event type: ${event.eventType}`);
        return { bookingId: null };
    }
  }

  private async handleOrderCreated(
    manager: EntityManager,
    event: SupplierWebhookEvent,
  ): Promise<{ bookingId: string | null } | null> {
    const orderId = event.supplierResourceId;
    if (!orderId) {
      this.logger.warn(`order.created event ${event.id} has no resource id.`);
      return { bookingId: null };
    }

    const bookingRepo = manager.getRepository(Booking);

    // Fast path: reconciliation (or an earlier webhook delivery) already linked it.
    let booking = await bookingRepo.findOneBy({ supplierOrderId: orderId });

    if (!booking) {
      const order = await this.duffelService.getOrder(orderId);
      const metadata = order['metadata'] as Record<string, string> | undefined;
      const internalKey = metadata?.['idempotency_key'];
      if (!internalKey) {
        return null;
      }
      booking = await bookingRepo.findOneBy({
        supplierIdempotencyKey: internalKey,
      });
      if (!booking) {
        return null;
      }
      if (booking.status === BookingStatus.Paid) {
        await this.reconciliation.confirmBookingFromOrder(
          manager,
          booking,
          order,
        );
      }
      return { bookingId: booking.id };
    }

    if (booking.status === BookingStatus.Paid) {
      const order = await this.duffelService.getOrder(orderId);
      await this.reconciliation.confirmBookingFromOrder(
        manager,
        booking,
        order,
      );
    }
    // Already confirmed/failed/refunded — replay-safe no-op.
    return { bookingId: booking.id };
  }

  private async handleScheduleChange(
    manager: EntityManager,
    event: SupplierWebhookEvent,
  ): Promise<{ bookingId: string | null } | null> {
    const orderId = event.supplierResourceId;
    if (!orderId) {
      this.logger.warn(`schedule-change event ${event.id} has no resource id.`);
      return { bookingId: null };
    }

    const booking = await manager
      .getRepository(Booking)
      .findOneBy({ supplierOrderId: orderId });
    if (!booking) {
      // Order not linked locally yet — retry once reconciliation/order.created lands.
      return null;
    }

    const order = await this.duffelService.getOrder(orderId);
    const rawSlices = (order['slices'] as any[]) ?? [];

    const snapshot = await manager.getRepository(FlightOfferSnapshot).findOne({
      where: { bookingId: booking.id },
      relations: { slices: { segments: true } },
    });

    const changes: {
      flightNumber: string;
      oldLocal: string;
      newLocal: string;
    }[] = [];

    if (snapshot) {
      // Slice/segment order isn't explicitly indexed — rely on the same
      // natural relation order bookings.service.ts's getBookingDetail uses.
      for (let i = 0; i < snapshot.slices.length; i++) {
        const rawSlice = rawSlices[i];
        if (!rawSlice) continue;
        const rawSegments = (rawSlice.segments as any[]) ?? [];
        const storedSegments = snapshot.slices[i].segments;

        for (let j = 0; j < storedSegments.length; j++) {
          const seg = storedSegments[j];
          const rawSeg = rawSegments[j];
          if (!rawSeg) continue;

          const newDepartingLocal = rawSeg.departing_at as string;
          const newArrivingLocal = rawSeg.arriving_at as string;

          if (
            newDepartingLocal &&
            newDepartingLocal !==
              seg.departingAtLocal.toISOString().slice(0, 19)
          ) {
            changes.push({
              flightNumber: seg.flightNumber,
              oldLocal: seg.departingAtLocal.toISOString().slice(0, 19),
              newLocal: newDepartingLocal,
            });
          }

          await manager.getRepository(Segment).update(seg.id, {
            departingAtLocal: newDepartingLocal
              ? new Date(newDepartingLocal)
              : seg.departingAtLocal,
            arrivingAtLocal: newArrivingLocal
              ? new Date(newArrivingLocal)
              : seg.arrivingAtLocal,
            originTimezone: rawSeg.origin?.time_zone ?? seg.originTimezone,
            destinationTimezone:
              rawSeg.destination?.time_zone ?? seg.destinationTimezone,
          });
        }
      }
    }

    await manager.getRepository(Booking).update(booking.id, {
      scheduleChangeDetectedAt: new Date(),
    });

    const user = await manager
      .getRepository(User)
      .findOneBy({ id: booking.userId });
    if (user && changes.length > 0) {
      this.mailService.sendScheduleChangeEmail(
        user.email,
        booking.id,
        booking.bookingReference,
        changes,
      );
    }

    this.logger.log(
      `Booking ${booking.id} flagged: airline schedule change (${changes.length} segment change(s)).`,
    );

    return { bookingId: booking.id };
  }
}
