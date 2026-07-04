import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { BookingsModule } from '../bookings/bookings.module';
import { Payment } from './entities/payment.entity';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { Refund } from './entities/refund.entity';

import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './services/payments.service';
import { StripeService } from './services/stripe.service';
import { PaymentWebhookProcessor } from './queues/payment-webhook.processor';
import { PaymentWebhookSweepService } from './services/payment-webhook-sweep.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      PaymentAttempt,
      PaymentWebhookEvent,
      Refund,
    ]),
    BullModule.registerQueue({
      name: 'stripe_webhook_queue',
    }),
    BookingsModule,
  ],
  controllers: [PaymentsController, WebhooksController],
  providers: [
    PaymentsService,
    StripeService,
    PaymentWebhookProcessor,
    PaymentWebhookSweepService,
  ],
  exports: [PaymentsService, StripeService],
})
export class PaymentsModule {}
