/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { PaymentsService } from './payments.service';
import { PaymobService } from './paymob.service';
import { BookingStateMachineService } from '../../bookings/services/booking-state-machine.service';
import { Payment } from '../entities/payment.entity';
import { PaymentAttempt } from '../entities/payment-attempt.entity';
import { Refund } from '../entities/refund.entity';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import { FlightOfferSnapshot } from '../../bookings/entities/flight-offer-snapshot.entity';
import { Passenger } from '../../bookings/entities/passenger.entity';
import { User, UserRole } from '../../users/user.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymobService: PaymobService;
  let mockEntityManager: any;

  const mockUser: User = {
    id: 'user_123',
    email: 'test@example.com',
    emailVerifiedAt: new Date(),
    fullName: 'Test User',
    phone: null,
    role: UserRole.User,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockEntityManager = {
      save: jest.fn().mockImplementation((cls, val) => Promise.resolve(val)),
      getRepository: jest.fn().mockImplementation((cls) => {
        if (cls === Booking) {
          return {
            createQueryBuilder: jest.fn().mockReturnValue({
              setLock: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockImplementation(() => {
                const b = new Booking();
                b.id = 'booking_123';
                b.userId = 'user_123';
                b.status = BookingStatus.AwaitingPayment;
                b.totalAmount = 10500;
                b.currency = 'USD';
                return Promise.resolve(b);
              }),
            }),
          };
        }
        if (cls === FlightOfferSnapshot) {
          return {
            findOneBy: jest.fn().mockImplementation(() => {
              const s = new FlightOfferSnapshot();
              s.bookingId = 'booking_123';
              s.expiresAt = new Date(Date.now() + 600000); // 10 mins in future
              return Promise.resolve(s);
            }),
          };
        }
        if (cls === Payment) {
          return {
            findOneBy: jest.fn().mockResolvedValue(null),
          };
        }
        if (cls === Passenger) {
          return {
            find: jest.fn().mockResolvedValue([]),
          };
        }
        return {};
      }),
    };

    mockEntityManager.transaction = jest.fn().mockImplementation((cb) => {
      return cb(mockEntityManager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PaymobService,
          useValue: {
            createPaymentKey: jest.fn().mockResolvedValue({
              orderId: 'paymob_order_123',
              paymentKey: 'paymob_key_123',
              iframeUrl: 'https://iframe_url',
            }),
          },
        },
        {
          provide: BookingStateMachineService,
          useValue: {
            transitionTo: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PaymentAttempt),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Refund),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymobService = module.get<PaymobService>(PaymobService);
  });

  describe('createOrGetPaymentAttempt', () => {
    it('should successfully create a paymob order and return payment details', async () => {
      const result = await service.createOrGetPaymentAttempt(
        mockUser,
        'booking_123',
      );

      expect(paymobService.createPaymentKey).toHaveBeenCalledWith(
        10500,
        'USD',
        expect.stringContaining('booking_123'),
        expect.any(Object),
      );
      expect(result.payment_token).toBe('paymob_key_123');
      expect(result.iframe_url).toBe('https://iframe_url');
      expect(result.amount).toBe(10500);
      expect(result.currency).toBe('USD');
    });

    it('should throw ForbiddenException if user does not own booking', async () => {
      const anotherUser = { ...mockUser, id: 'user_456' };
      await expect(
        service.createOrGetPaymentAttempt(anotherUser, 'booking_123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if booking is not awaiting_payment status', async () => {
      mockEntityManager.getRepository = jest.fn().mockImplementation((cls) => {
        if (cls === Booking) {
          return {
            createQueryBuilder: jest.fn().mockReturnValue({
              setLock: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockImplementation(() => {
                const b = new Booking();
                b.id = 'booking_123';
                b.userId = 'user_123';
                b.status = BookingStatus.Paid; // Already paid
                return Promise.resolve(b);
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.createOrGetPaymentAttempt(mockUser, 'booking_123'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
