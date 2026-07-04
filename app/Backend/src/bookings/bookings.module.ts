import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { DuffelModule } from '../duffel/duffel.module';
import { User } from '../users/user.entity';
import { MarkupRule } from './entities/markup-rule.entity';
import { Booking } from './entities/booking.entity';
import { FlightOfferSnapshot } from './entities/flight-offer-snapshot.entity';
import { Slice } from './entities/slice.entity';
import { Segment } from './entities/segment.entity';
import { Passenger } from './entities/passenger.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';
import { Document } from './entities/document.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Refund } from '../payments/entities/refund.entity';

import { BookingsController } from './bookings.controller';
import { BookingsService } from './services/bookings.service';
import { MarkupService } from './services/markup.service';
import { BookingStateMachineService } from './services/booking-state-machine.service';
import { ExpirySweepService } from './services/expiry-sweep.service';
import { OrderFulfillmentService } from './services/order-fulfillment.service';
import { OrderFulfillmentProcessor } from './queues/order-fulfillment.processor';
import { DuffelReconciliationService } from './services/duffel-reconciliation.service';

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
      Document,
      Payment,
      Refund,
    ]),
    DuffelModule,
    BullModule.registerQueue({
      name: 'order_fulfillment_queue',
    }),
  ],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    MarkupService,
    BookingStateMachineService,
    ExpirySweepService,
    OrderFulfillmentService,
    OrderFulfillmentProcessor,
    DuffelReconciliationService,
  ],
  exports: [
    BookingsService,
    MarkupService,
    BookingStateMachineService,
    OrderFulfillmentService,
  ],
})
export class BookingsModule {}
