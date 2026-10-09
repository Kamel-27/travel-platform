import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, LessThan } from 'typeorm';

import { DuffelService } from '../../duffel/duffel.service';
import { FulfillmentOutcomeService } from './fulfillment-outcome.service';
import { Booking, BookingStatus } from '../entities/booking.entity';

/**
 * Reconciliation sweep for bookings stuck in `paid` status.
 *
 * Runs every 2 minutes. For bookings stuck in `paid` for >15 minutes,
 * scans Duffel's orders and matches by metadata (supplier_idempotency_key)
 * to determine if the order was created.
 *
 * - Found → T5 confirmed
 * - Verified absent (the FULL order list was read) → T6 order_failed + refund
 * - Lookup failed or the scan was cut short → unknown; stays `paid`, retried
 *   next run. Never refund on an unproven absence — the ticket may exist.
 *
 * Per booking_state_machine.md §4: NEVER re-POST an order.
 */
@Injectable()
export class DuffelReconciliationService {
  private readonly logger = new Logger(DuffelReconciliationService.name);

  /** Bookings stuck in paid longer than this are eligible for reconciliation */
  private readonly RECONCILIATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly duffelService: DuffelService,
    private readonly fulfillmentOutcome: FulfillmentOutcomeService,
  ) {}

  @Cron('*/2 * * * *')
  async sweepStuckPaidBookings(): Promise<void> {
    this.logger.debug('Running Duffel reconciliation sweep...');

    const cutoff = new Date(Date.now() - this.RECONCILIATION_WINDOW_MS);

    const stuckBookings = await this.entityManager.getRepository(Booking).find({
      where: {
        status: BookingStatus.Paid,
        updatedAt: LessThan(cutoff),
      },
    });

    if (stuckBookings.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${stuckBookings.length} bookings stuck in paid for >15 min`,
    );

    for (const booking of stuckBookings) {
      try {
        await this.reconcileBooking(booking);
      } catch (err: unknown) {
        // Includes Duffel lookup failures: the booking stays paid and is
        // retried on the next run.
        this.logger.error(
          `Reconciliation failed for booking ${booking.id}; left in paid for the next run`,
          err,
        );
      }
    }
  }

  /**
   * Attempts to reconcile a single stuck booking by checking Duffel
   * for a matching order via metadata.
   */
  private async reconcileBooking(booking: Booking): Promise<void> {
    this.logger.log(`Reconciling booking ${booking.id}...`);

    const { order, complete } = await this.duffelService.findOrder((o) => {
      const metadata = o['metadata'] as Record<string, string> | undefined;
      return (
        metadata?.['supplier_idempotency_key'] ===
        booking.supplierIdempotencyKey
      );
    });

    if (order) {
      const applied = await this.entityManager.transaction((manager) =>
        this.confirmBookingFromOrder(
          manager,
          booking,
          order,
          'Reconciliation sweep found Duffel order',
        ),
      );
      if (applied) {
        await this.fulfillmentOutcome.sendConfirmationEmail(booking.id);
      }
      return;
    }

    if (!complete) {
      this.logger.error(
        `Reconciliation for booking ${booking.id} hit the order-scan page cap without finding a match — absence NOT verified; left in paid. Check Duffel manually.`,
      );
      return;
    }

    await this.fulfillmentOutcome.failPaidBookingAndRefund(
      booking.id,
      'Reconciliation sweep: order verified absent after 15-minute window',
      'order_verified_absent_reconciliation',
    );
  }

  /**
   * Shared T5 (paid → confirmed) application, reused by both this sweep and
   * the `order.created` Duffel webhook fast path (duffel-webhook.processor.ts).
   * Replay-safe: returns false without writing anything when the booking is
   * no longer `paid`. On true the caller sends the confirmation email after
   * its transaction commits.
   */
  confirmBookingFromOrder(
    manager: EntityManager,
    booking: Booking,
    order: Record<string, unknown>,
    reason = 'Duffel order.created webhook confirmed order',
  ): Promise<boolean> {
    return this.fulfillmentOutcome.confirmPaidBooking(
      manager,
      booking.id,
      this.duffelService.mapOrderResult(order),
      reason,
    );
  }
}
