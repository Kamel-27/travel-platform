/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { OrderFulfillmentService } from './order-fulfillment.service';
import {
  DuffelService,
  DuffelDefinitiveError,
  DuffelAmbiguousError,
} from '../../duffel/duffel.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { Booking, BookingStatus, Supplier } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import {
  Passenger,
  PassengerType,
  PassengerTitle,
  PassengerGender,
} from '../entities/passenger.entity';
import { Document } from '../entities/document.entity';
import { LedgerService } from '../../ledger/services/ledger.service';
import { LedgerEntryType } from '../../ledger/entities/ledger-entry.entity';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { Refund } from '../../payments/entities/refund.entity';

describe('OrderFulfillmentService', () => {
  let service: OrderFulfillmentService;
  let ledgerService: any;
  let duffelService: DuffelService;
  let stateMachine: BookingStateMachineService;
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
  };

  const mockPassengers: Partial<Passenger>[] = [
    {
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
      phoneNumber: '+1234567890',
      documentType: 'passport',
      documentNumber: 'AB123456',
      documentExpiry: '2030-01-01',
      nationality: 'US',
      responsibleAdultPassengerId: null,
    },
  ];

  const mockPayment: Partial<Payment> = {
    id: 'pay_001',
    bookingId: 'booking_001',
    status: PaymentStatus.Succeeded,
    amount: 105000,
    currency: 'USD',
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
  let mockSnapshotRepo: any;
  let mockPassengerRepo: any;
  let mockPaymentRepo: any;

  beforeEach(async () => {
    mockBookingRepo = {
      findOneBy: jest.fn().mockResolvedValue(mockBooking),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockSnapshotRepo = {
      findOneBy: jest.fn().mockResolvedValue(mockSnapshot),
    };
    mockPassengerRepo = {
      find: jest.fn().mockResolvedValue(mockPassengers),
    };
    mockPaymentRepo = {
      findOneBy: jest.fn().mockResolvedValue(mockPayment),
    };

    mockEntityManager = {
      getRepository: jest.fn().mockImplementation((cls) => {
        if (cls === Booking) return mockBookingRepo;
        if (cls === FlightOfferSnapshot) return mockSnapshotRepo;
        if (cls === Passenger) return mockPassengerRepo;
        if (cls === Payment) return mockPaymentRepo;
        return {
          findOneBy: jest.fn().mockResolvedValue(null),
          find: jest.fn().mockResolvedValue([]),
        };
      }),
      save: jest.fn().mockImplementation((cls, val) => Promise.resolve(val)),
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
          provide: BookingStateMachineService,
          useValue: {
            transitionTo: jest.fn().mockResolvedValue(mockBooking),
          },
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: LedgerService,
          useValue: {
            createEntry: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<OrderFulfillmentService>(OrderFulfillmentService);
    ledgerService = module.get(LedgerService);
    duffelService = module.get<DuffelService>(DuffelService);
    stateMachine = module.get<BookingStateMachineService>(
      BookingStateMachineService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fulfillOrder — 201 success (T5)', () => {
    it('should transition booking to confirmed and create document rows', async () => {
      await service.fulfillOrder('booking_001');

      // Verify createOrder was called with correct params
      expect(duffelService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          offerId: 'off_0000AUd7VfJtL0S4Lq7xLq',
          metadata: {
            booking_id: 'booking_001',
            supplier_idempotency_key: 'idempotency_key_001',
          },
        }),
      );

      // Verify booking was updated with order details
      expect(mockBookingRepo.update).toHaveBeenCalledWith('booking_001', {
        supplierOrderId: 'ord_duffel_001',
        bookingReference: 'ABC123',
      });

      // Verify T5 transition
      expect(stateMachine.transitionTo).toHaveBeenCalledWith(
        expect.any(Object),
        'booking_001',
        BookingStatus.Confirmed,
        null,
        'Duffel order created successfully',
      );

      // Verify Document row was created
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        Document,
        expect.objectContaining({
          bookingId: 'booking_001',
          type: 'electronic_ticket',
          uniqueIdentifier: '0123456789',
          supplierPassengerIds: ['pas_duffel_001'],
        }),
      );

      // Verify the supplier charge hit the ledger with a negative base amount
      expect(ledgerService.createEntry).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          entryType: LedgerEntryType.SupplierCharge,
          amount: -100000,
          currency: 'USD',
          supplier: Supplier.Duffel,
          bookingId: 'booking_001',
        }),
      );
    });
  });

  describe('fulfillOrder — 4xx definitive failure (T6)', () => {
    it('should transition booking to order_failed and create auto-refund', async () => {
      (duffelService.createOrder as jest.Mock).mockRejectedValue(
        new DuffelDefinitiveError(422, 'Offer expired at supplier'),
      );

      await service.fulfillOrder('booking_001');

      // Verify T6 transition
      expect(stateMachine.transitionTo).toHaveBeenCalledWith(
        expect.any(Object),
        'booking_001',
        BookingStatus.OrderFailed,
        null,
        expect.stringContaining('Duffel order rejected'),
      );

      // Verify auto-refund created
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        Refund,
        expect.objectContaining({
          paymentId: 'pay_001',
          amount: 105000,
          currency: 'USD',
          reason: 'supplier_order_rejected',
        }),
      );
    });
  });

  describe('fulfillOrder — 500/timeout ambiguous failure', () => {
    it('should NOT change booking status — stays in paid', async () => {
      (duffelService.createOrder as jest.Mock).mockRejectedValue(
        new DuffelAmbiguousError('Timeout', 'req_123'),
      );

      await service.fulfillOrder('booking_001');

      // No state transition should happen
      expect(stateMachine.transitionTo).not.toHaveBeenCalled();

      // No refund should be created
      expect(mockEntityManager.save).not.toHaveBeenCalledWith(
        Refund,
        expect.anything(),
      );
    });
  });

  describe('fulfillOrder — guard checks', () => {
    it('should skip fulfillment if booking is not in paid status', async () => {
      const notPaidBooking = {
        ...mockBooking,
        status: BookingStatus.Confirmed,
      };
      mockEntityManager.getRepository = jest.fn().mockImplementation((cls) => {
        if (cls === Booking) {
          return { findOneBy: jest.fn().mockResolvedValue(notPaidBooking) };
        }
        return { findOneBy: jest.fn().mockResolvedValue(null) };
      });

      await service.fulfillOrder('booking_001');

      expect(duffelService.createOrder).not.toHaveBeenCalled();
      expect(stateMachine.transitionTo).not.toHaveBeenCalled();
    });

    it('should handle missing booking gracefully', async () => {
      mockEntityManager.getRepository = jest.fn().mockReturnValue({
        findOneBy: jest.fn().mockResolvedValue(null),
      });

      await service.fulfillOrder('nonexistent');

      expect(duffelService.createOrder).not.toHaveBeenCalled();
    });
  });
});
