/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { DuffelReconciliationService } from './duffel-reconciliation.service';
import { DuffelService } from '../../duffel/duffel.service';
import { FulfillmentOutcomeService } from './fulfillment-outcome.service';
import { Booking, BookingStatus, Supplier } from '../entities/booking.entity';

describe('DuffelReconciliationService', () => {
  let service: DuffelReconciliationService;
  let duffelService: any;
  let outcome: any;
  let mockEntityManager: any;
  let mockBookingRepo: any;

  const stuckBooking: Partial<Booking> = {
    id: 'booking_stuck_001',
    userId: 'user_001',
    status: BookingStatus.Paid,
    supplier: Supplier.Duffel,
    supplierIdempotencyKey: 'idemp_key_stuck',
    totalAmount: 105000,
    currency: 'USD',
    createdAt: new Date('2026-07-04T10:00:00Z'),
    updatedAt: new Date('2026-07-04T10:00:00Z'),
  };

  const matchingOrder = {
    id: 'ord_duffel_found',
    booking_reference: 'FOUND123',
    metadata: { supplier_idempotency_key: 'idemp_key_stuck' },
    documents: [],
  };
  const mappedOrder = {
    orderId: 'ord_duffel_found',
    bookingReference: 'FOUND123',
    documents: [],
  };

  beforeEach(async () => {
    mockBookingRepo = {
      find: jest.fn().mockResolvedValue([stuckBooking]),
    };
    mockEntityManager = {
      getRepository: jest.fn().mockReturnValue(mockBookingRepo),
      transaction: jest.fn().mockImplementation((cb) => cb(mockEntityManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuffelReconciliationService,
        {
          provide: DuffelService,
          useValue: {
            findOrder: jest
              .fn()
              .mockResolvedValue({ order: null, complete: true }),
            mapOrderResult: jest.fn().mockReturnValue(mappedOrder),
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

    service = module.get(DuffelReconciliationService);
    duffelService = module.get(DuffelService);
    outcome = module.get(FulfillmentOutcomeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing when no stuck bookings exist', async () => {
    mockBookingRepo.find.mockResolvedValue([]);

    await service.sweepStuckPaidBookings();

    expect(duffelService.findOrder).not.toHaveBeenCalled();
  });

  it('matches orders on our supplier_idempotency_key', async () => {
    await service.sweepStuckPaidBookings();

    const match = duffelService.findOrder.mock.calls[0][0];
    expect(match(matchingOrder)).toBe(true);
    expect(match({ metadata: { supplier_idempotency_key: 'other' } })).toBe(
      false,
    );
  });

  it('confirms and emails when the order is found (T5)', async () => {
    duffelService.findOrder.mockResolvedValue({
      order: matchingOrder,
      complete: true,
    });

    await service.sweepStuckPaidBookings();

    expect(outcome.confirmPaidBooking).toHaveBeenCalledWith(
      mockEntityManager,
      'booking_stuck_001',
      mappedOrder,
      'Reconciliation sweep found Duffel order',
    );
    expect(outcome.sendConfirmationEmail).toHaveBeenCalledWith(
      'booking_stuck_001',
    );
    expect(outcome.failPaidBookingAndRefund).not.toHaveBeenCalled();
  });

  it('fails and refunds only on a verified absence (T6)', async () => {
    await service.sweepStuckPaidBookings();

    expect(outcome.failPaidBookingAndRefund).toHaveBeenCalledWith(
      'booking_stuck_001',
      expect.stringContaining('Reconciliation sweep'),
      'order_verified_absent_reconciliation',
    );
  });

  it('leaves the booking paid when the order scan was cut short', async () => {
    duffelService.findOrder.mockResolvedValue({ order: null, complete: false });

    await service.sweepStuckPaidBookings();

    expect(outcome.failPaidBookingAndRefund).not.toHaveBeenCalled();
    expect(outcome.confirmPaidBooking).not.toHaveBeenCalled();
  });

  it('leaves the booking paid when Duffel is unreachable — never refunds a ticket that may exist', async () => {
    duffelService.findOrder.mockRejectedValue(
      new ServiceUnavailableException('Duffel down'),
    );

    await expect(service.sweepStuckPaidBookings()).resolves.toBeUndefined();

    expect(outcome.failPaidBookingAndRefund).not.toHaveBeenCalled();
  });
});
