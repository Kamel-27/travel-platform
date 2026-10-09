/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { OrderFulfillmentService } from './order-fulfillment.service';
import {
  DuffelService,
  DuffelDefinitiveError,
  DuffelAmbiguousError,
} from '../../duffel/duffel.service';
import { FulfillmentOutcomeService } from './fulfillment-outcome.service';
import { Booking, BookingStatus, Supplier } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import {
  Passenger,
  PassengerType,
  PassengerTitle,
  PassengerGender,
} from '../entities/passenger.entity';

describe('OrderFulfillmentService', () => {
  let service: OrderFulfillmentService;
  let duffelService: DuffelService;
  let outcome: any;
  let mockEntityManager: any;

  const mockBooking: Partial<Booking> = {
    id: 'booking_001',
    userId: 'user_001',
    status: BookingStatus.Paid,
    supplier: Supplier.Duffel,
    supplierIdempotencyKey: 'idempotency_key_001',
    supplierOrderId: null,
    bookingReference: null,
    baseAmount: 100000,
    markupAmount: 5000,
    totalAmount: 105000,
    currency: 'USD',
  };

  const mockSnapshot: Partial<FlightOfferSnapshot> = {
    id: 'snapshot_001',
    bookingId: 'booking_001',
    supplierOfferId: 'off_0000AUd7VfJtL0S4Lq7xLq',
    totalAmount: 100000,
    currency: 'USD',
  };

  const adult: Partial<Passenger> = {
    id: 'pax_001',
    bookingId: 'booking_001',
    supplierPassengerId: 'pas_duffel_001',
    type: PassengerType.Adult,
    title: PassengerTitle.Mr,
    gender: PassengerGender.M,
    givenName: 'John',
    familyName: 'Doe',
    dateOfBirth: '1990-01-01',
    email: 'john@example.com',
    phoneNumber: '+201091241325',
    documentType: 'passport',
    documentNumber: 'AB123456',
    documentExpiry: '2030-01-01',
    nationality: 'EG',
    responsibleAdultPassengerId: null,
  };

  const mockOrderResult = {
    orderId: 'ord_duffel_001',
    bookingReference: 'ABC123',
    documents: [
      {
        type: 'electronic_ticket',
        uniqueIdentifier: '0123456789',
        passengerIds: ['pas_duffel_001'],
      },
    ],
  };

  let mockBookingRepo: any;
  let mockPassengerRepo: any;

  const sentPassengers = () =>
    (duffelService.createOrder as jest.Mock).mock.calls[0][0].passengers;

  beforeEach(async () => {
    mockBookingRepo = {
      findOneBy: jest.fn().mockResolvedValue(mockBooking),
    };
    mockPassengerRepo = {
      find: jest.fn().mockResolvedValue([adult]),
    };

    mockEntityManager = {
      getRepository: jest.fn().mockImplementation((cls) => {
        if (cls === Booking) return mockBookingRepo;
        if (cls === FlightOfferSnapshot) {
          return { findOneBy: jest.fn().mockResolvedValue(mockSnapshot) };
        }
        if (cls === Passenger) return mockPassengerRepo;
        return { findOneBy: jest.fn().mockResolvedValue(null) };
      }),
      transaction: jest.fn().mockImplementation((cb) => cb(mockEntityManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderFulfillmentService,
        {
          provide: DuffelService,
          useValue: {
            createOrder: jest.fn().mockResolvedValue(mockOrderResult),
          },
        },
        {
          provide: FulfillmentOutcomeService,
          useValue: {
            confirmPaidBooking: jest.fn().mockResolvedValue(true),
            failPaidBookingAndRefund: jest.fn().mockResolvedValue(true),
            sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: EntityManager, useValue: mockEntityManager },
      ],
    }).compile();

    service = module.get(OrderFulfillmentService);
    duffelService = module.get(DuffelService);
    outcome = module.get(FulfillmentOutcomeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('201 success (T5)', () => {
    it('creates the order at the offer total and confirms through the shared outcome', async () => {
      await service.fulfillOrder('booking_001');

      expect(duffelService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          offerId: 'off_0000AUd7VfJtL0S4Lq7xLq',
          amount: 100000,
          currency: 'USD',
          metadata: {
            booking_id: 'booking_001',
            supplier_idempotency_key: 'idempotency_key_001',
          },
        }),
      );
      expect(outcome.confirmPaidBooking).toHaveBeenCalledWith(
        mockEntityManager,
        'booking_001',
        mockOrderResult,
        'Duffel order created successfully',
      );
      expect(outcome.sendConfirmationEmail).toHaveBeenCalledWith('booking_001');
    });

    it('sends no second email when the webhook already confirmed the booking', async () => {
      outcome.confirmPaidBooking.mockResolvedValueOnce(false);

      await service.fulfillOrder('booking_001');

      expect(outcome.sendConfirmationEmail).not.toHaveBeenCalled();
    });
  });

  describe('4xx definitive failure (T6)', () => {
    it('fails the booking and refunds through the shared outcome', async () => {
      (duffelService.createOrder as jest.Mock).mockRejectedValue(
        new DuffelDefinitiveError(422, 'offer_no_longer_available'),
      );

      await service.fulfillOrder('booking_001');

      expect(outcome.failPaidBookingAndRefund).toHaveBeenCalledWith(
        'booking_001',
        expect.stringContaining('Duffel order rejected'),
        'supplier_order_rejected',
      );
      expect(outcome.confirmPaidBooking).not.toHaveBeenCalled();
    });
  });

  describe('500/timeout ambiguous failure', () => {
    it('leaves the booking in paid for reconciliation', async () => {
      (duffelService.createOrder as jest.Mock).mockRejectedValue(
        new DuffelAmbiguousError('Timeout', 'req_123'),
      );

      await service.fulfillOrder('booking_001');

      expect(outcome.confirmPaidBooking).not.toHaveBeenCalled();
      expect(outcome.failPaidBookingAndRefund).not.toHaveBeenCalled();
    });
  });

  describe('passenger mapping', () => {
    it('puts infant_passenger_id on the responsible ADULT, pointing at the infant', async () => {
      const infant: Partial<Passenger> = {
        ...adult,
        id: 'pax_002',
        supplierPassengerId: 'pas_duffel_infant',
        type: PassengerType.Infant,
        givenName: 'Baby',
        dateOfBirth: '2026-01-01',
        responsibleAdultPassengerId: 'pax_001',
      };
      mockPassengerRepo.find.mockResolvedValue([adult, infant]);

      await service.fulfillOrder('booking_001');

      const [sentAdult, sentInfant] = sentPassengers();
      expect(sentAdult.infant_passenger_id).toBe('pas_duffel_infant');
      expect(sentInfant.infant_passenger_id).toBeUndefined();
    });

    it('sends a complete identity document', async () => {
      await service.fulfillOrder('booking_001');

      expect(sentPassengers()[0].identity_documents).toEqual([
        {
          type: 'passport',
          unique_identifier: 'AB123456',
          expires_on: '2030-01-01',
          issuing_country_code: 'EG',
        },
      ]);
    });

    it('omits an incomplete identity document instead of sending blanks', async () => {
      mockPassengerRepo.find.mockResolvedValue([
        { ...adult, documentExpiry: null },
      ]);

      await service.fulfillOrder('booking_001');

      expect(sentPassengers()[0].identity_documents).toBeUndefined();
    });
  });

  describe('guard checks', () => {
    it('skips fulfillment if booking is not in paid status', async () => {
      mockBookingRepo.findOneBy.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.Confirmed,
      });

      await service.fulfillOrder('booking_001');

      expect(duffelService.createOrder).not.toHaveBeenCalled();
    });

    it('handles a missing booking gracefully', async () => {
      mockBookingRepo.findOneBy.mockResolvedValue(null);

      await service.fulfillOrder('nonexistent');

      expect(duffelService.createOrder).not.toHaveBeenCalled();
    });
  });
});
