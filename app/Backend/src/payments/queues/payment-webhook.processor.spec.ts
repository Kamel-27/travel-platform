/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { getQueueToken } from '@nestjs/bullmq';

import { PaymentWebhookProcessor } from './payment-webhook.processor';
import { BookingStateMachineService } from '../../bookings/services/booking-state-machine.service';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
} from '../entities/payment-attempt.entity';
import { PaymentWebhookEvent } from '../entities/payment-webhook-event.entity';
import { LedgerService } from '../../ledger/services/ledger.service';
import { LedgerEntryType } from '../../ledger/entities/ledger-entry.entity';

describe('PaymentWebhookProcessor', () => {
  let processor: PaymentWebhookProcessor;
  let ledgerService: any;
  let stateMachine: BookingStateMachineService;
  let mockEntityManager: any;
  let mockEventQueryBuilder: any;
  let mockBookingQueryBuilder: any;
  let mockOrderFulfillmentQueue: any;

  const mockWebhookEvent = {
    id: 'evt_123',
    provider: 'paymob',
    providerEventId: '99999:transaction.succeeded',
    eventType: 'transaction.succeeded',
    payload: {
      type: 'TRANSACTION',
      obj: {
        id: 99999,
        pending: false,
        success: true,
        amount_cents: 10500,
        order: {
          id: 12345,
        },
      },
    },
    processedAt: null,
  };

  const mockAttempt = {
    id: 'att_123',
    paymentId: 'pay_123',
    providerReferenceId: '12345',
    status: PaymentAttemptStatus.RequiresAction,
  };

  const mockPayment = {
    id: 'pay_123',
    bookingId: 'booking_123',
    status: PaymentStatus.Pending,
    amount: 10500,
    currency: 'EGP',
  };

  const mockBooking = {
    id: 'booking_123',
    status: BookingStatus.AwaitingPayment,
    totalAmount: 10500,
  };

  beforeEach(async () => {
    mockEventQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockWebhookEvent),
    };

    mockBookingQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockBooking),
    };

    mockEntityManager = {
      save: jest.fn().mockImplementation((cls, val) => Promise.resolve(val)),
      getRepository: jest.fn().mockImplementation((cls) => {
        if (cls === PaymentWebhookEvent) {
          return {
            createQueryBuilder: jest
              .fn()
              .mockReturnValue(mockEventQueryBuilder),
          };
        }
        if (cls === Booking) {
          return {
            createQueryBuilder: jest
              .fn()
              .mockReturnValue(mockBookingQueryBuilder),
          };
        }
        if (cls === PaymentAttempt) {
          return { findOne: jest.fn().mockResolvedValue(mockAttempt) };
        }
        if (cls === Payment) {
          return { findOneBy: jest.fn().mockResolvedValue(mockPayment) };
        }
        return {};
      }),
    };

    mockEntityManager.transaction = jest.fn().mockImplementation((cb) => {
      return cb(mockEntityManager);
    });

    mockOrderFulfillmentQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentWebhookProcessor,
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
          provide: getQueueToken('order_fulfillment_queue'),
          useValue: mockOrderFulfillmentQueue,
        },
        {
          provide: LedgerService,
          useValue: {
            createEntry: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    processor = module.get<PaymentWebhookProcessor>(PaymentWebhookProcessor);
    ledgerService = module.get(LedgerService);
    stateMachine = module.get<BookingStateMachineService>(
      BookingStateMachineService,
    );
  });

  it('should successfully process succeeded payment, updating states and invoking state transition (T4)', async () => {
    const mockJob: any = { data: { eventId: 'evt_123' } };

    await processor.process(mockJob);

    expect(stateMachine.transitionTo).toHaveBeenCalledWith(
      expect.any(Object),
      'booking_123',
      BookingStatus.Paid,
      null,
      'Paymob transaction succeeded',
    );

    expect(mockEntityManager.save).toHaveBeenCalledWith(
      PaymentAttempt,
      expect.objectContaining({ status: PaymentAttemptStatus.Succeeded }),
    );
    expect(mockEntityManager.save).toHaveBeenCalledWith(
      Payment,
      expect.objectContaining({ status: PaymentStatus.Succeeded }),
    );
    expect(mockEntityManager.save).toHaveBeenCalledWith(
      PaymentWebhookEvent,
      expect.objectContaining({ processedAt: expect.any(Date) }),
    );

    // Verify the customer payment was recorded in the ledger (positive amount)
    expect(ledgerService.createEntry).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        entryType: LedgerEntryType.CustomerPayment,
        amount: 10500,
        currency: 'EGP',
        paymentId: 'pay_123',
        bookingId: 'booking_123',
      }),
    );

    // Verify order fulfillment job was enqueued after T4 — requestId is a
    // freshly generated correlation id since this test job carries none.
    expect(mockOrderFulfillmentQueue.add).toHaveBeenCalledWith(
      'create_duffel_order',
      { bookingId: 'booking_123', requestId: expect.any(String) },
      expect.objectContaining({ attempts: 1 }),
    );
  });
});
