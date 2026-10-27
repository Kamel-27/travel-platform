import { ConflictException } from '@nestjs/common';
import type Redis from 'ioredis';
import { BookingsController } from './bookings.controller';
import type { BookingsService } from './services/bookings.service';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../users/user.entity';
import { ErrorCode } from '../common/dto/error-response.dto';

describe('BookingsController — POST /bookings idempotency', () => {
  const alice: JwtPayload = { sub: 'user-alice', role: UserRole.User };
  const bob: JwtPayload = { sub: 'user-bob', role: UserRole.User };
  const dto = { offer_id: 'off_123' };

  let redis: { get: jest.Mock; setex: jest.Mock; del: jest.Mock };
  let service: { createBooking: jest.Mock; getBookingDetail: jest.Mock };
  let controller: BookingsController;

  beforeEach(() => {
    redis = { get: jest.fn(), setex: jest.fn(), del: jest.fn() };
    service = {
      createBooking: jest.fn().mockResolvedValue({ id: 'bk_new' }),
      getBookingDetail: jest.fn().mockResolvedValue({ id: 'bk_existing' }),
    };
    controller = new BookingsController(
      service as unknown as BookingsService,
      redis as unknown as Redis,
    );
  });

  it('creates directly when no Idempotency-Key is sent', async () => {
    await expect(controller.createBooking(alice, dto)).resolves.toEqual({
      id: 'bk_new',
    });
    expect(redis.get).not.toHaveBeenCalled();
    expect(service.createBooking).toHaveBeenCalledWith(alice, 'off_123');
  });

  it('scopes the Redis key to the caller, so two users with the same header do not collide', async () => {
    redis.get.mockResolvedValue(null);

    await controller.createBooking(alice, dto, 'same-key');
    await controller.createBooking(bob, dto, 'same-key');

    const keysRead = redis.get.mock.calls.map((c: unknown[]) => c[0]);
    expect(keysRead).toEqual([
      'idempotency_booking:user-alice:same-key',
      'idempotency_booking:user-bob:same-key',
    ]);
    expect(service.createBooking).toHaveBeenCalledTimes(2);
  });

  it('locks for 120 s during creation and stores the booking id for 24 h', async () => {
    redis.get.mockResolvedValue(null);

    await controller.createBooking(alice, dto, 'k1');

    expect(redis.setex).toHaveBeenNthCalledWith(
      1,
      'idempotency_booking:user-alice:k1',
      120,
      'locked',
    );
    expect(redis.setex).toHaveBeenNthCalledWith(
      2,
      'idempotency_booking:user-alice:k1',
      86400,
      'bk_new',
    );
  });

  it('replays the existing booking through the owner-checked detail path', async () => {
    redis.get.mockResolvedValue('bk_existing');

    await expect(controller.createBooking(alice, dto, 'k1')).resolves.toEqual({
      id: 'bk_existing',
    });

    expect(service.getBookingDetail).toHaveBeenCalledWith(alice, 'bk_existing');
    expect(service.createBooking).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('rejects a concurrent duplicate with 409 while the key is locked', async () => {
    redis.get.mockResolvedValue('locked');

    await expect(controller.createBooking(alice, dto, 'k1')).rejects.toThrow(
      ConflictException,
    );
    await expect(
      controller.createBooking(alice, dto, 'k1'),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.ILLEGAL_TRANSITION },
    });
    expect(service.createBooking).not.toHaveBeenCalled();
  });

  it('releases the lock when creation fails so the client can retry', async () => {
    redis.get.mockResolvedValue(null);
    service.createBooking.mockRejectedValue(new Error('duffel down'));

    await expect(controller.createBooking(alice, dto, 'k1')).rejects.toThrow(
      'duffel down',
    );

    expect(redis.del).toHaveBeenCalledWith('idempotency_booking:user-alice:k1');
  });
});
