import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { BookingStatusHistory } from '../entities/booking-status-history.entity';
import { ErrorCode } from '../../common/dto/error-response.dto';

@Injectable()
export class BookingStateMachineService {
  private readonly logger = new Logger(BookingStateMachineService.name);

  private readonly LEGAL_TRANSITIONS: Record<
    BookingStatus,
    Set<BookingStatus>
  > = {
    [BookingStatus.Pending]: new Set([
      BookingStatus.AwaitingPayment,
      BookingStatus.Failed,
    ]),
    [BookingStatus.AwaitingPayment]: new Set([
      BookingStatus.Paid,
      BookingStatus.Failed,
    ]),
    [BookingStatus.Paid]: new Set([
      BookingStatus.Confirmed,
      BookingStatus.OrderFailed,
    ]),
    [BookingStatus.Confirmed]: new Set([BookingStatus.Cancelled]),
    [BookingStatus.Cancelled]: new Set([BookingStatus.Refunded]),
    [BookingStatus.OrderFailed]: new Set([BookingStatus.Refunded]),
    [BookingStatus.Failed]: new Set(),
    [BookingStatus.Refunded]: new Set(),
  };

  /**
   * Executes a state transition on a Booking within a shared transaction and takes a row lock.
   * Enforces transition constraints and records history.
   * If applying the same target state (replay), it executes a no-op successfully.
   */
  async transitionTo(
    entityManager: EntityManager,
    bookingId: string,
    toStatus: BookingStatus,
    changedByUserId: string | null,
    reason: string | null,
  ): Promise<Booking> {
    // 1. Take row lock on the booking (SELECT ... FOR UPDATE) to serialize updates
    const booking = await entityManager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .setLock('pessimistic_write')
      .where('booking.id = :id', { id: bookingId })
      .getOne();

    if (!booking) {
      throw new ConflictException({
        code: ErrorCode.NOT_FOUND,
        message: 'Booking not found during status transition.',
      });
    }

    const fromStatus = booking.status;

    // 2. Idempotency on replay: same status is a no-op
    if (fromStatus === toStatus) {
      this.logger.debug(
        `Idempotency trigger: Booking ${bookingId} already in status ${toStatus}`,
      );
      return booking;
    }

    // 3. Guard: Validate legal transition path
    const allowed = this.LEGAL_TRANSITIONS[fromStatus];
    if (!allowed || !allowed.has(toStatus)) {
      this.logger.warn(
        `Illegal transition attempted: ${fromStatus} -> ${toStatus} for booking ${bookingId}`,
      );
      throw new ConflictException({
        code: ErrorCode.ILLEGAL_TRANSITION,
        message: `Illegal transition from ${fromStatus} to ${toStatus}.`,
      });
    }

    // 4. Update status and save
    booking.status = toStatus;
    const savedBooking = await entityManager.save(Booking, booking);

    // 5. Record state transition history in the same transaction
    const history = new BookingStatusHistory();
    history.bookingId = bookingId;
    history.fromStatus = fromStatus;
    history.toStatus = toStatus;
    history.changedByUserId = changedByUserId;
    history.reason = reason;

    await entityManager.save(BookingStatusHistory, history);

    this.logger.log(
      `Transitioned booking ${bookingId}: ${fromStatus} -> ${toStatus} (reason: ${reason ?? 'none'})`,
    );

    return savedBooking;
  }

  /**
   * Helper to write an initial status history record when a booking is created.
   */
  async recordInitialHistory(
    entityManager: EntityManager,
    bookingId: string,
    userId: string,
    reason: string | null = 'Booking initiated',
  ): Promise<void> {
    const history = new BookingStatusHistory();
    history.bookingId = bookingId;
    history.fromStatus = BookingStatus.Pending;
    history.toStatus = BookingStatus.Pending;
    history.changedByUserId = userId;
    history.reason = reason;

    await entityManager.save(BookingStatusHistory, history);
  }
}
