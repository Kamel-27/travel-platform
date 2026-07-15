import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from '../auth/auth.module';
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
import { SupplierWebhookEvent } from './entities/supplier-webhook-event.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Refund } from '../payments/entities/refund.entity';
import { PaymentWebhookEvent } from '../payments/entities/payment-webhook-event.entity';
import { PaymobModule } from '../payments/paymob.module';
import { LedgerModule } from '../ledger/ledger.module';

import { BookingsController } from './bookings.controller';
import { DuffelWebhooksController } from './duffel-webhooks.controller';
import { BookingsService } from './services/bookings.service';
import { MarkupService } from './services/markup.service';
import { BookingStateMachineService } from './services/booking-state-machine.service';
import { ExpirySweepService } from './services/expiry-sweep.service';
import { OrderFulfillmentService } from './services/order-fulfillment.service';
import { OrderFulfillmentProcessor } from './queues/order-fulfillment.processor';
import { DuffelReconciliationService } from './services/duffel-reconciliation.service';
import { RefundExecutionService } from './services/refund-execution.service';
import { DuffelWebhookProcessor } from './queues/duffel-webhook.processor';
import { RefundExecutionProcessor } from './queues/refund-execution.processor';
import { REFUND_EXECUTION_QUEUE } from './queues/refund-execution.queue';
import { DuffelWebhookSweepService } from './services/duffel-webhook-sweep.service';
import { TicketPdfService } from './services/ticket-pdf.service';

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
      SupplierWebhookEvent,
      Payment,
      Refund,
      PaymentWebhookEvent,
    ]),
    AuthModule,
    DuffelModule,
    PaymobModule,
    LedgerModule,
    BullModule.registerQueue(
      { name: 'order_fulfillment_queue' },
      { name: 'duffel_webhook_queue' },
      { name: REFUND_EXECUTION_QUEUE },
    ),
  ],
  controllers: [BookingsController, DuffelWebhooksController],
  providers: [
    BookingsService,
    MarkupService,
    BookingStateMachineService,
    ExpirySweepService,
    OrderFulfillmentService,
    OrderFulfillmentProcessor,
    DuffelReconciliationService,
    RefundExecutionService,
    RefundExecutionProcessor,
    DuffelWebhookProcessor,
    DuffelWebhookSweepService,
    TicketPdfService,
  ],
  exports: [
    BookingsService,
    MarkupService,
    BookingStateMachineService,
    OrderFulfillmentService,
    RefundExecutionService,
  ],
})
export class BookingsModule {}
