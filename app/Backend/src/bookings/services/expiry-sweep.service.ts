import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { FlightOfferSnapshot } from '../entities/flight-offer-snapshot.entity';
import { BookingStateMachineService } from './booking-state-machine.service';

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
