import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DuffelModule } from '../duffel/duffel.module';
import { User } from '../users/user.entity';
import { MarkupRule } from './entities/markup-rule.entity';
import { Booking } from './entities/booking.entity';
import { FlightOfferSnapshot } from './entities/flight-offer-snapshot.entity';
import { Slice } from './entities/slice.entity';
import { Segment } from './entities/segment.entity';
import { Passenger } from './entities/passenger.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';

import { BookingsController } from './bookings.controller';
import { BookingsService } from './services/bookings.service';
import { MarkupService } from './services/markup.service';
import { BookingStateMachineService } from './services/booking-state-machine.service';
import { ExpirySweepService } from './services/expiry-sweep.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      MarkupRule,
      Booking,
      FlightOfferSnapshot,
      Slice,
      Segment,
      Passenger,
      BookingStatusHistory,
    ]),
    DuffelModule,
  ],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    MarkupService,
    BookingStateMachineService,
    ExpirySweepService,
  ],
  exports: [BookingsService, MarkupService, BookingStateMachineService],
})
export class BookingsModule {}
