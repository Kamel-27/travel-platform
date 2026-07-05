import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';

import {
  DuffelService,
  DuffelDefinitiveError,
  DuffelAmbiguousError,
  CreateOrderPassenger,
} from '../../duffel/duffel.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import { Passenger, PassengerType } from '../entities/passenger.entity';
import { Document } from '../entities/document.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Refund, RefundStatus } from '../../payments/entities/refund.entity';

@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly duffelService: DuffelService,
    private readonly stateMachine: BookingStateMachineService,
  ) {}

  /**
   * Attempts to create a Duffel order for a paid booking.
   * Implements the paid recovery matrix (booking_state_machine.md §4):
   * - 201/200 → T5 confirmed
   * - 4xx     → T6 order_failed + auto-refund
   * - 500/timeout → stay in paid (reconciliation handles it)
   */
  async fulfillOrder(bookingId: string): Promise<void> {
    this.logger.log(`Starting order fulfillment for booking ${bookingId}`);

    // 1. Load booking and verify status
    const booking = await this.entityManager
      .getRepository(Booking)
      .findOneBy({ id: bookingId });

    if (!booking) {
      this.logger.error(`Booking ${bookingId} not found for fulfillment`);
      return;
    }

    if (booking.status !== BookingStatus.Paid) {
      this.logger.debug(
        `Booking ${bookingId} is in status ${booking.status}, not paid. Skipping fulfillment.`,
      );
      return;
    }

    // 2. Load snapshot and passengers
    const snapshot = await this.entityManager
      .getRepository(FlightOfferSnapshot)
      .findOneBy({ bookingId });

    if (!snapshot) {
      this.logger.error(
        `FlightOfferSnapshot not found for booking ${bookingId}`,
      );
      return;
    }

    const passengers = await this.entityManager
      .getRepository(Passenger)
      .find({ where: { bookingId } });

    if (passengers.length === 0) {
      this.logger.error(`No passengers found for booking ${bookingId}`);
      return;
    }

    // 3. Map passengers to Duffel format
    const duffelPassengers = this.mapPassengersToDuffel(passengers);

    // 4. Attempt order creation
    try {
      const orderResult = await this.duffelService.createOrder({
        offerId: snapshot.supplierOfferId,
        passengers: duffelPassengers,
        amount: snapshot.totalAmount,
        currency: snapshot.currency,
        metadata: {
          booking_id: booking.id,
          supplier_idempotency_key: booking.supplierIdempotencyKey,
        },
      });

      // SUCCESS — T5: paid → confirmed
      await this.handleOrderSuccess(booking, orderResult);
    } catch (err: unknown) {
      if (err instanceof DuffelDefinitiveError) {
        // T6: paid → order_failed + auto-refund
        await this.handleDefinitiveFailure(booking, err);
      } else if (err instanceof DuffelAmbiguousError) {
        // Stay in paid — reconciliation sweep will resolve
        this.handleAmbiguousFailure(booking, err);
      } else {
        // Unexpected error — treat as ambiguous
        this.logger.error(
          `Unexpected error during order fulfillment for booking ${bookingId}`,
          err,
        );
      }
    }
  }

  /**
   * T5: Successful order creation — transition to confirmed.
   */
  private async handleOrderSuccess(
    booking: Booking,
    orderResult: {
      orderId: string;
      bookingReference: string;
      documents: {
        type: string;
        uniqueIdentifier: string;
        passengerIds: string[];
      }[];
    },
  ): Promise<void> {
    await this.entityManager.transaction(async (manager) => {
      // Set supplier order ID and booking reference
      await manager.getRepository(Booking).update(booking.id, {
        supplierOrderId: orderResult.orderId,
        bookingReference: orderResult.bookingReference,
      });

      // T5: paid → confirmed
      await this.stateMachine.transitionTo(
        manager,
        booking.id,
        BookingStatus.Confirmed,
        null, // system transition
        'Duffel order created successfully',
      );

      // Create Document rows from e-ticket data
      for (const doc of orderResult.documents) {
        const document = new Document();
        document.bookingId = booking.id;
        document.type = doc.type;
        document.uniqueIdentifier = doc.uniqueIdentifier;
        document.supplierPassengerIds = doc.passengerIds;
        await manager.save(Document, document);
      }
    });

    this.logger.log(
      `Booking ${booking.id} confirmed — order ${orderResult.orderId}, PNR: ${orderResult.bookingReference}`,
    );

    // Stub: Enqueue PDF generation + confirmation email
    this.logger.log(
      `TODO: Enqueue itinerary PDF generation and confirmation email for booking ${booking.id}`,
    );
  }

  /**
   * T6: Definitive failure — transition to order_failed and auto-refund.
   */
  private async handleDefinitiveFailure(
    booking: Booking,
    error: DuffelDefinitiveError,
  ): Promise<void> {
    await this.entityManager.transaction(async (manager) => {
      // T6: paid → order_failed
      await this.stateMachine.transitionTo(
        manager,
        booking.id,
        BookingStatus.OrderFailed,
        null, // system transition
        `Duffel order rejected: ${error.message}`,
      );

      // Auto-create refund for full amount (PRD §5.3)
      const payment = await manager
        .getRepository(Payment)
        .findOneBy({ bookingId: booking.id });

      if (payment) {
        const refund = new Refund();
        refund.paymentId = payment.id;
        refund.providerRefundId = `auto_refund_${randomUUID().slice(0, 8)}`;
        refund.amount = booking.totalAmount;
        refund.currency = booking.currency;
        refund.status = RefundStatus.Pending;
        refund.reason = 'supplier_order_rejected';
        refund.initiatedByUserId = null; // system-initiated

        await manager.save(Refund, refund);

        this.logger.log(
          `Auto-refund created for booking ${booking.id}: ${refund.amount} ${refund.currency}`,
        );
      }
    });

    this.logger.warn(
      `Booking ${booking.id} → order_failed. Duffel HTTP ${error.statusCode}: ${error.message}`,
    );
  }

  /**
   * Ambiguous failure — stay in paid, log for admin/reconciliation.
   */
  private handleAmbiguousFailure(
    booking: Booking,
    error: DuffelAmbiguousError,
  ): void {
    this.logger.warn(
      `Booking ${booking.id} stays in paid (ambiguous outcome). ` +
        `Error: ${error.message}` +
        (error.requestId ? ` | request_id: ${error.requestId}` : ''),
    );
    // The reconciliation sweep (DuffelReconciliationService) will handle this
  }

  /**
   * Maps internal Passenger entities to Duffel's CreateOrder passenger format.
   */
  private mapPassengersToDuffel(
    passengers: Passenger[],
  ): CreateOrderPassenger[] {
    return passengers
      .filter((p) => p.supplierPassengerId) // Only passengers with Duffel IDs
      .map((p) => {
        const duffelPax: CreateOrderPassenger = {
          id: p.supplierPassengerId!,
          given_name: p.givenName,
          family_name: p.familyName,
          title: p.title,
          gender: p.gender,
          born_on: p.dateOfBirth,
          email: p.email,
          phone_number: p.phoneNumber,
        };

        // Link infant to responsible adult's Duffel passenger ID
        if (p.type === PassengerType.Infant && p.responsibleAdultPassengerId) {
          // Find the adult's supplier passenger ID
          const adult = passengers.find(
            (a) => a.id === p.responsibleAdultPassengerId,
          );
          if (adult?.supplierPassengerId) {
            duffelPax.infant_passenger_id = adult.supplierPassengerId;
          }
        }

        // Attach identity documents if present
        if (p.documentType && p.documentNumber) {
          duffelPax.identity_documents = [
            {
              type: p.documentType === 'passport' ? 'passport' : p.documentType,
              unique_identifier: p.documentNumber,
              expires_on: p.documentExpiry ?? '',
              issuing_country_code: p.nationality ?? '',
            },
          ];
        }

        return duffelPax;
      });
  }
}
