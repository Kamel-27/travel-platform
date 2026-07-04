/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ExpirySweepService } from './expiry-sweep.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { EntityManager } from 'typeorm';
import { Booking, BookingStatus } from '../entities/booking.entity';

describe('ExpirySweepService', () => {
  let service: ExpirySweepService;
  let stateMachine: BookingStateMachineService;
  let mockEntityManager: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    mockEntityManager = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      }),
      transaction: jest.fn().mockImplementation((cb) => cb(mockEntityManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpirySweepService,
        {
          provide: BookingStateMachineService,
          useValue: {
            transitionTo: jest.fn().mockResolvedValue(new Booking()),
          },
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
      ],
    }).compile();

    service = module.get<ExpirySweepService>(ExpirySweepService);
    stateMachine = module.get<BookingStateMachineService>(
      BookingStateMachineService,
    );
  });

  it('should find expired bookings and transition them to failed', async () => {
    const mockBooking = new Booking();
    mockBooking.id = 'booking_expired';
    mockBooking.status = BookingStatus.Pending;

    mockQueryBuilder.getMany.mockResolvedValue([mockBooking]);

    await service.sweepExpiredBookings();

    expect(stateMachine.transitionTo).toHaveBeenCalledWith(
      expect.any(Object),
      'booking_expired',
      BookingStatus.Failed,
      null,
      'offer_expired',
    );
  });

  it('should do nothing if no expired bookings are found', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);

    await service.sweepExpiredBookings();

    expect(stateMachine.transitionTo).not.toHaveBeenCalled();
  });
});
