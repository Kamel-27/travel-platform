/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { DuffelReconciliationService } from './duffel-reconciliation.service';
import { DuffelService } from '../../duffel/duffel.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { Booking, BookingStatus, Supplier } from '../entities/booking.entity';
import { Document } from '../entities/document.entity';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { Refund } from '../../payments/entities/refund.entity';

describe('DuffelReconciliationService', () => {
  let service: DuffelReconciliationService;
  let duffelService: DuffelService;
  let stateMachine: BookingStateMachineService;
  let mockEntityManager: any;

  const stuckBooking: Partial<Booking> = {
    id: 'booking_stuck_001',
    userId: 'user_001',
    status: BookingStatus.Paid,
    supplier: Supplier.Duffel,
    supplierIdempotencyKey: 'idemp_key_stuck',
    supplierOrderId: null,
    bookingReference: null,
    totalAmount: 105000,
    currency: 'USD',
    createdAt: new Date('2026-07-04T10:00:00Z'),
    updatedAt: new Date('2026-07-04T10:00:00Z'),
  };

  const mockPayment: Partial<Payment> = {
    id: 'pay_stuck',
    bookingId: 'booking_stuck_001',
    status: PaymentStatus.Succeeded,
    amount: 105000,
    currency: 'USD',
  };

  let mockBookingRepo: any;
  let mockPaymentRepo: any;

  beforeEach(async () => {
    mockBookingRepo = {
      find: jest.fn().mockResolvedValue([stuckBooking]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockPaymentRepo = {
      findOneBy: jest.fn().mockResolvedValue(mockPayment),
    };

    mockEntityManager = {
      getRepository: jest.fn().mockImplementation((cls) => {
        if (cls === Booking) return mockBookingRepo;
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
        DuffelReconciliationService,
        {
          provide: DuffelService,
          useValue: {
            listOrders: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: BookingStateMachineService,
          useValue: {
            transitionTo: jest.fn().mockResolvedValue(stuckBooking),
          },
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
      ],
    }).compile();

    service = module.get<DuffelReconciliationService>(
      DuffelReconciliationService,
    );
    duffelService = module.get<DuffelService>(DuffelService);
    stateMachine = module.get<BookingStateMachineService>(
      BookingStateMachineService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sweepStuckPaidBookings', () => {
    it('should do nothing when no stuck bookings exist', async () => {
      mockEntityManager.getRepository = jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });

      await service.sweepStuckPaidBookings();

      expect(duffelService.listOrders).not.toHaveBeenCalled();
      expect(stateMachine.transitionTo).not.toHaveBeenCalled();
    });

    it('should transition to confirmed when matching order found (T5)', async () => {
      const matchingDuffelOrder = {
        id: 'ord_duffel_found',
        booking_reference: 'FOUND123',
        metadata: { supplier_idempotency_key: 'idemp_key_stuck' },
        documents: [
          {
            type: 'electronic_ticket',
            unique_identifier: '9876543210',
            passenger_ids: ['pas_001'],
          },
        ],
      };

      (duffelService.listOrders as jest.Mock).mockResolvedValue([
        matchingDuffelOrder,
      ]);

      await service.sweepStuckPaidBookings();

      // Verify order data was persisted
      expect(mockBookingRepo.update).toHaveBeenCalledWith('booking_stuck_001', {
        supplierOrderId: 'ord_duffel_found',
        bookingReference: 'FOUND123',
      });

      // Verify T5 transition
      expect(stateMachine.transitionTo).toHaveBeenCalledWith(
        expect.any(Object),
        'booking_stuck_001',
        BookingStatus.Confirmed,
        null,
        'Reconciliation sweep found Duffel order',
      );

      // Verify Document row created
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        Document,
        expect.objectContaining({
          bookingId: 'booking_stuck_001',
          type: 'electronic_ticket',
          uniqueIdentifier: '9876543210',
        }),
      );
    });

    it('should transition to order_failed and create refund when verified absent (T6)', async () => {
      // No matching orders found
      (duffelService.listOrders as jest.Mock).mockResolvedValue([
        {
          id: 'ord_other',
          metadata: { supplier_idempotency_key: 'other_key' },
        },
      ]);

      await service.sweepStuckPaidBookings();

      // Verify T6 transition
      expect(stateMachine.transitionTo).toHaveBeenCalledWith(
        expect.any(Object),
        'booking_stuck_001',
        BookingStatus.OrderFailed,
        null,
        expect.stringContaining('Reconciliation sweep'),
      );

      // Verify auto-refund created
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        Refund,
        expect.objectContaining({
          paymentId: 'pay_stuck',
          amount: 105000,
          currency: 'USD',
          reason: 'order_verified_absent_reconciliation',
        }),
      );
    });
  });
});
