/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { BookingsService } from './bookings.service';
import { DuffelService } from '../../duffel/duffel.service';
import { MarkupService } from './markup.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import { Passenger, PassengerType } from '../entities/passenger.entity';
import { User, UserRole } from '../../users/user.entity';

describe('BookingsService', () => {
  let service: BookingsService;
  let duffelService: DuffelService;
  let markupService: MarkupService;
  let stateMachine: BookingStateMachineService;
  let mockRedis: any;
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

  const mockNormalizedOffer = {
    offer_id: 'off_1',
    expires_at: new Date(Date.now() + 600000).toISOString(),
    total: { amount: 10000, currency: 'USD' },
    airline: { name: 'Saudi', iata: 'SV', logo_url: '' },
    cabin_class: 'economy',
    passenger_identity_documents_required: false,
    slices: [
      {
        origin: 'CAI',
        destination: 'RUH',
        duration: 'PT2H',
        segments: [
          {
            marketing_carrier: 'SV',
            operating_carrier: 'SV',
            flight_number: '123',
            departing_at: {
              local: '2026-08-01T09:15:00',
              timezone: 'Africa/Cairo',
            },
            arriving_at: {
              local: '2026-08-01T12:40:00',
              timezone: 'Asia/Riyadh',
            },
            origin_terminal: '3',
            destination_terminal: null,
          },
        ],
      },
    ],
    conditions: {
      refund_before_departure: {
        allowed: true,
        penalty: { amount: 30000, currency: 'USD' },
      },
    },
    passengers: [{ id: 'pas_1', type: 'adult' }],
  };

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      hset: jest.fn().mockResolvedValue(1),
      hmget: jest.fn().mockResolvedValue(['100', Date.now().toString()]),
      del: jest.fn().mockResolvedValue(1),
    };

    mockEntityManager = {
      save: jest.fn().mockImplementation((cls, obj) => {
        if (!obj.id) obj.id = 'uuid_' + Math.random().toString();
        return Promise.resolve(obj);
      }),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockImplementation(() => {
            const b = new Booking();
            b.id = 'booking_123';
            b.userId = 'user_123';
            b.status = BookingStatus.Pending;
            b.baseAmount = 10000;
            b.markupAmount = 500;
            b.totalAmount = 10500;
            b.currency = 'USD';
            return Promise.resolve(b);
          }),
        }),
        findOneBy: jest.fn().mockImplementation(() => {
          const s = new FlightOfferSnapshot();
          s.bookingId = 'booking_123';
          s.expiresAt = new Date(Date.now() + 600000);
          s.passengerIdentityDocumentsRequired = false;
          s.rawOffer = { passengers: [{ id: 'pas_1', type: 'adult' }] };
          return Promise.resolve(s);
        }),
      }),
    };
    mockEntityManager.transaction = jest.fn().mockImplementation((cb) => {
      return cb(mockEntityManager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: DuffelService,
          useValue: {
            fetchOffer: jest.fn().mockResolvedValue(mockNormalizedOffer),
          },
        },
        {
          provide: MarkupService,
          useValue: {
            calculateMarkup: jest
              .fn()
              .mockResolvedValue({ ruleId: 'rule_1', amount: 500 }),
          },
        },
        {
          provide: BookingStateMachineService,
          useValue: {
            transitionTo: jest.fn().mockImplementation((mgr, bId, status) => {
              const b = new Booking();
              b.id = bId;
              b.status = status;
              b.totalAmount = 10500;
              b.currency = 'USD';
              return Promise.resolve(b);
            }),
            recordInitialHistory: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(FlightOfferSnapshot),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Passenger),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    duffelService = module.get<DuffelService>(DuffelService);
    markupService = module.get<MarkupService>(MarkupService);
    stateMachine = module.get<BookingStateMachineService>(
      BookingStateMachineService,
    );
  });

  describe('createBooking', () => {
    it('should successfully create a pending booking with snapshot, slices, and segments', async () => {
      const result = await service.createBooking(mockUser, 'off_1');

      expect(duffelService.fetchOffer).toHaveBeenCalledWith('off_1');
      expect(markupService.calculateMarkup).toHaveBeenCalledWith(10000);
      expect(stateMachine.recordInitialHistory).toHaveBeenCalled();
      expect(result.status).toBe(BookingStatus.Pending);
      expect(result.passenger_requirements).toEqual({
        passenger_identity_documents_required: false,
        passengers: [{ supplier_passenger_id: 'pas_1', type: 'adult' }],
      });
    });

    it('should throw GONE exception if the offer is already expired', async () => {
      const expiredOffer = {
        ...mockNormalizedOffer,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      };
      (duffelService.fetchOffer as jest.Mock).mockResolvedValueOnce(
        expiredOffer,
      );

      await expect(service.createBooking(mockUser, 'off_1')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('savePassengers', () => {
    const validPassengerInputs = [
      {
        type: PassengerType.Adult,
        title: 'mr',
        gender: 'm',
        given_name: 'Ahmed',
        family_name: 'Hassan',
        date_of_birth: '1990-04-12',
        email: 'a@example.com',
        phone_number: '+201001234567',
      } as any,
    ];

    it('should successfully save passenger details and transition status to awaiting_payment', async () => {
      const result = await service.savePassengers(
        mockUser,
        'booking_123',
        validPassengerInputs,
      );

      expect(stateMachine.transitionTo).toHaveBeenCalledWith(
        expect.any(Object),
        'booking_123',
        BookingStatus.AwaitingPayment,
        'user_123',
        'Passengers details saved',
      );
      expect(result.client_secret).toBeDefined();
      expect(result.status).toBe(BookingStatus.AwaitingPayment);
    });

    it('should throw BadRequestException if passenger count is incorrect', async () => {
      await expect(
        service.savePassengers(mockUser, 'booking_123', []),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
