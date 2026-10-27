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

  it('leaves bookings with a payment attempt still in flight out of the sweep', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);

    const before = Date.now();
    await service.sweepExpiredBookings();

    const guard = mockQueryBuilder.andWhere.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('requires_action'),
    );
    expect(guard).toBeDefined();
    expect(guard[0]).toContain('NOT EXISTS');
    expect(guard[0]).toContain('pa.attempted_at > :graceCutoff');
    const cutoff = (guard[1] as { graceCutoff: Date }).graceCutoff;
    // 30-minute grace window, measured from "now"
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(
      30 * 60 * 1000 - 1000,
    );
    expect(before - cutoff.getTime()).toBeLessThan(30 * 60 * 1000 + 5000);
  });

  it('should do nothing if no expired bookings are found', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);

    await service.sweepExpiredBookings();

    expect(stateMachine.transitionTo).not.toHaveBeenCalled();
  });
});
