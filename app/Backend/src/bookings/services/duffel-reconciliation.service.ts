/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, LessThan } from 'typeorm';
import { randomUUID } from 'crypto';

import { DuffelService } from '../../duffel/duffel.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { Document } from '../entities/document.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Refund, RefundStatus } from '../../payments/entities/refund.entity';

/**
 * Reconciliation sweep for bookings stuck in `paid` status.
 *
 * Runs every 2 minutes. For bookings stuck in `paid` for >15 minutes,
 * queries Duffel's list-orders endpoint and matches by metadata
 * (supplier_idempotency_key) to determine if the order was created.
 *
 * - Found → T5 confirmed
 * - Verified absent → T6 order_failed + auto-refund
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
    private readonly stateMachine: BookingStateMachineService,
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
        this.logger.error(
          `Reconciliation failed for booking ${booking.id}`,
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

    // Query Duffel for orders created after this booking
    const orders = await this.duffelService.listOrders({
      createdAfter: booking.createdAt.toISOString(),
      limit: 200,
    });

    // Search for an order whose metadata contains our idempotency key
    const matchingOrder = orders.find((order: Record<string, unknown>) => {
      const metadata = order['metadata'] as Record<string, string> | undefined;
      return (
        metadata?.['supplier_idempotency_key'] ===
        booking.supplierIdempotencyKey
      );
    });

    if (matchingOrder) {
      // Found → T5 confirmed
      await this.handleOrderFound(booking, matchingOrder);
    } else {
      // Verified absent → T6 order_failed
      await this.handleVerifiedAbsent(booking);
    }
  }

  /**
   * Order found via reconciliation → T5 confirmed.
   */
  private async handleOrderFound(
    booking: Booking,
    order: Record<string, unknown>,
  ): Promise<void> {
    const orderId = order['id'] as string;
    const bookingReference = (order['booking_reference'] as string) ?? '';
    const rawDocuments = (order['documents'] as any[]) ?? [];

    await this.entityManager.transaction(async (manager) => {
      // Set supplier order data
      await manager.getRepository(Booking).update(booking.id, {
        supplierOrderId: orderId,
        bookingReference,
      });

      // T5: paid → confirmed
      await this.stateMachine.transitionTo(
        manager,
        booking.id,
        BookingStatus.Confirmed,
        null,
        'Reconciliation sweep found Duffel order',
      );

      // Create Document rows
      for (const doc of rawDocuments) {
        const document = new Document();
        document.bookingId = booking.id;
        document.type = doc.type as string;
        document.uniqueIdentifier = doc.unique_identifier as string;
        document.supplierPassengerIds = (doc.passenger_ids as string[]) ?? [];
        await manager.save(Document, document);
      }
    });

    this.logger.log(
      `Reconciliation: Booking ${booking.id} → confirmed (order: ${orderId}, PNR: ${bookingReference})`,
    );
  }

  /**
   * Verified absent → T6 order_failed + auto-refund.
   */
  private async handleVerifiedAbsent(booking: Booking): Promise<void> {
    await this.entityManager.transaction(async (manager) => {
      // T6: paid → order_failed
      await this.stateMachine.transitionTo(
        manager,
        booking.id,
        BookingStatus.OrderFailed,
        null,
        'Reconciliation sweep: order verified absent after 15-minute window',
      );

      // Auto-create refund for full amount
      const payment = await manager
        .getRepository(Payment)
        .findOneBy({ bookingId: booking.id });

      if (payment) {
        const refund = new Refund();
        refund.paymentId = payment.id;
        refund.providerRefundId = `auto_refund_recon_${randomUUID().slice(0, 8)}`;
        refund.amount = booking.totalAmount;
        refund.currency = booking.currency;
        refund.status = RefundStatus.Pending;
        refund.reason = 'order_verified_absent_reconciliation';
        refund.initiatedByUserId = null;

        await manager.save(Refund, refund);

        this.logger.log(
          `Reconciliation auto-refund created for booking ${booking.id}: ${refund.amount} ${refund.currency}`,
        );
      }
    });

    this.logger.warn(
      `Reconciliation: Booking ${booking.id} → order_failed (verified absent)`,
    );
  }
}
