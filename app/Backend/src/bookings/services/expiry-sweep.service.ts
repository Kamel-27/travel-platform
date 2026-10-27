import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import { BookingStateMachineService } from './booking-state-machine.service';

/**
 * How long a payment attempt that is still `requires_action` keeps its
 * booking out of the expiry sweep. A customer on the Paymob page when the
 * offer expires would otherwise be moved to `failed` mid-checkout, and the
 * capture that lands seconds later could only be refunded, never honoured.
 */
export const PAYMENT_IN_FLIGHT_GRACE_MS = 30 * 60 * 1000;

@Injectable()
export class ExpirySweepService {
  private readonly logger = new Logger(ExpirySweepService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly stateMachine: BookingStateMachineService,
  ) {}

  /**
   * Periodically scans for bookings in 'pending' or 'awaiting_payment' statuses
   * where the flight offer expires_at timestamp has passed, transitioning them to 'failed'.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepExpiredBookings(): Promise<void> {
    this.logger.debug('Running background booking expiry sweep...');
    const now = new Date();

    const expiredBookings = await this.entityManager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .innerJoin(
        FlightOfferSnapshot,
        'snapshot',
        'snapshot.booking_id = booking.id',
      )
      .where('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.Pending, BookingStatus.AwaitingPayment],
      })
      .andWhere('snapshot.expires_at <= :now', { now })
      // Leave a booking alone while the customer may still be on the
      // payment page: a recent attempt in requires_action means a capture
      // can arrive any second. The next sweep picks it up once the grace
      // window has passed (or the attempt has failed).
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM payment_attempts pa
          INNER JOIN payments p ON p.id = pa.payment_id
          WHERE p.booking_id = booking.id
            AND pa.status = 'requires_action'
            AND pa.attempted_at > :graceCutoff
        )`,
        { graceCutoff: new Date(now.getTime() - PAYMENT_IN_FLIGHT_GRACE_MS) },
      )
      .getMany();

    if (expiredBookings.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${expiredBookings.length} expired bookings to invalidate during sweep.`,
    );

    for (const booking of expiredBookings) {
      try {
        await this.entityManager.transaction(async (manager) => {
          await this.stateMachine.transitionTo(
            manager,
            booking.id,
            BookingStatus.Failed,
            null, // system/webhook triggered
            'offer_expired',
          );
        });
        this.logger.log(
          `Successfully invalidated expired booking ${booking.id} via sweep.`,
        );
      } catch (err: unknown) {
        this.logger.error(
          `Failed to invalidate expired booking ${booking.id} during sweep:`,
          err,
        );
      }
    }
  }
}
