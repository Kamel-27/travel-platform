import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import {
  DuffelService,
  DuffelDefinitiveError,
  DuffelAmbiguousError,
  CreateOrderPassenger,
  DuffelOrderResult,
} from '../../duffel/duffel.service';
import { FulfillmentOutcomeService } from './fulfillment-outcome.service';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import { Passenger, PassengerType } from '../entities/passenger.entity';

@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly duffelService: DuffelService,
    private readonly fulfillmentOutcome: FulfillmentOutcomeService,
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
   * T5: Successful order creation — transition to confirmed. A no-op when
   * the `order.created` webhook won the race; whichever path actually
   * confirms sends the confirmation email.
   */
  private async handleOrderSuccess(
    booking: Booking,
    orderResult: DuffelOrderResult,
  ): Promise<void> {
    const applied = await this.entityManager.transaction((manager) =>
      this.fulfillmentOutcome.confirmPaidBooking(
        manager,
        booking.id,
        orderResult,
        'Duffel order created successfully',
      ),
    );
    if (applied) {
      await this.fulfillmentOutcome.sendConfirmationEmail(booking.id);
    }
  }

  /**
   * T6: Definitive failure — transition to order_failed and auto-refund.
   */
  private async handleDefinitiveFailure(
    booking: Booking,
    error: DuffelDefinitiveError,
  ): Promise<void> {
    await this.fulfillmentOutcome.failPaidBookingAndRefund(
      booking.id,
      `Duffel order rejected: ${error.message}`,
      'supplier_order_rejected',
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

        // Duffel links a lap infant from the ADULT's side: the responsible
        // adult carries `infant_passenger_id` = the infant's Duffel id.
        if (p.type === PassengerType.Adult) {
          const infant = passengers.find(
            (i) =>
              i.type === PassengerType.Infant &&
              i.responsibleAdultPassengerId === p.id &&
              i.supplierPassengerId,
          );
          if (infant) {
            duffelPax.infant_passenger_id = infant.supplierPassengerId!;
          }
        }

        // Send a document only when it is complete — blank expiry/country
        // strings are rejected by Duffel after the customer has already paid.
        if (
          p.documentType &&
          p.documentNumber &&
          p.documentExpiry &&
          p.nationality
        ) {
          duffelPax.identity_documents = [
            {
              type: p.documentType,
              unique_identifier: p.documentNumber,
              expires_on: p.documentExpiry,
              issuing_country_code: p.nationality,
            },
          ];
        }

        return duffelPax;
      });
  }
}
