/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { PaymentWebhookProcessor } from './payment-webhook.processor';
import { BookingStateMachineService } from '../../bookings/services/booking-state-machine.service';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
} from '../entities/payment-attempt.entity';
import { PaymentWebhookEvent } from '../entities/payment-webhook-event.entity';

describe('PaymentWebhookProcessor', () => {
  let processor: PaymentWebhookProcessor;
  let stateMachine: BookingStateMachineService;
  let mockEntityManager: any;
  let mockEventQueryBuilder: any;
  let mockBookingQueryBuilder: any;

  const mockWebhookEvent = {
    id: 'evt_123',
    provider: 'stripe',
    providerEventId: 'evt_id_stripe',
    eventType: 'payment_intent.succeeded',
    payload: {
      data: {
        object: {
          id: 'pi_123',
          amount: 10500,
          metadata: {
            booking_id: 'booking_123',
          },
        },
      },
    },
    processedAt: null,
  };

  const mockAttempt = {
    id: 'att_123',
    paymentId: 'pay_123',
    providerReferenceId: 'pi_123',
    status: PaymentAttemptStatus.Processing,
  };

  const mockPayment = {
    id: 'pay_123',
    bookingId: 'booking_123',
    status: PaymentStatus.Pending,
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
      ],
    }).compile();

    processor = module.get<PaymentWebhookProcessor>(PaymentWebhookProcessor);
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
      'Stripe payment intent succeeded',
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
  });
});
