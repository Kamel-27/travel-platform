/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { BookingStateMachineService } from './booking-state-machine.service';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { BookingStatusHistory } from '../entities/booking-status-history.entity';

describe('BookingStateMachineService', () => {
  let service: BookingStateMachineService;
  let mockEntityManager: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    mockEntityManager = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      }),
      save: jest
        .fn()
        .mockImplementation((entityClass, val) => Promise.resolve(val)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BookingStateMachineService],
    }).compile();

    service = module.get<BookingStateMachineService>(
      BookingStateMachineService,
    );
  });

  it('should transition booking status legally and record history', async () => {
    const booking = new Booking();
    booking.id = 'booking_123';
    booking.status = BookingStatus.Pending;

    mockQueryBuilder.getOne.mockResolvedValue(booking);

    const result = await service.transitionTo(
      mockEntityManager,
      'booking_123',
      BookingStatus.AwaitingPayment,
      'user_123',
      'Completed passenger details',
    );

    expect(result.status).toBe(BookingStatus.AwaitingPayment);
    expect(mockEntityManager.save).toHaveBeenCalledWith(
      Booking,
      expect.objectContaining({ status: BookingStatus.AwaitingPayment }),
    );
    expect(mockEntityManager.save).toHaveBeenCalledWith(
      BookingStatusHistory,
      expect.objectContaining({
        fromStatus: BookingStatus.Pending,
        toStatus: BookingStatus.AwaitingPayment,
        changedByUserId: 'user_123',
        reason: 'Completed passenger details',
      }),
    );
  });

  it('should perform no-op on replay (idempotency)', async () => {
    const booking = new Booking();
    booking.id = 'booking_123';
    booking.status = BookingStatus.AwaitingPayment;

    mockQueryBuilder.getOne.mockResolvedValue(booking);

    const result = await service.transitionTo(
      mockEntityManager,
      'booking_123',
      BookingStatus.AwaitingPayment,
      'user_123',
      'Completed details retry',
    );

    expect(result.status).toBe(BookingStatus.AwaitingPayment);
    expect(mockEntityManager.save).not.toHaveBeenCalled();
  });

  it('should throw ConflictException on illegal transition', async () => {
    const booking = new Booking();
    booking.id = 'booking_123';
    booking.status = BookingStatus.Confirmed;

    mockQueryBuilder.getOne.mockResolvedValue(booking);

    await expect(
      service.transitionTo(
        mockEntityManager,
        'booking_123',
        BookingStatus.Failed,
        'user_123',
        'Expired',
      ),
    ).rejects.toThrow(ConflictException);
  });
});
