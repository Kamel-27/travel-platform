import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymobModule } from './paymob.module';
import { LedgerModule } from '../ledger/ledger.module';
import { Payment } from './entities/payment.entity';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { Refund } from './entities/refund.entity';

import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './services/payments.service';
import { PaymentWebhookProcessor } from './queues/payment-webhook.processor';
import { PaymentWebhookSweepService } from './services/payment-webhook-sweep.service';
import { WebhookRetentionService } from './services/webhook-retention.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      PaymentAttempt,
      PaymentWebhookEvent,
      Refund,
    ]),
    BullModule.registerQueue(
      { name: 'payment_webhook_queue' },
      { name: 'order_fulfillment_queue' },
    ),
    AuthModule,
    BookingsModule,
    PaymobModule,
    LedgerModule,
  ],
  controllers: [PaymentsController, WebhooksController],
  providers: [
    PaymentsService,
    PaymentWebhookProcessor,
    PaymentWebhookSweepService,
    WebhookRetentionService,
  ],
  exports: [PaymentsService, PaymobModule],
})
export class PaymentsModule {}
