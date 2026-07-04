/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { StripeService } from './services/stripe.service';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { PaymentProvider } from './entities/payment.entity';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly stripeService: StripeService,
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookRepo: Repository<PaymentWebhookEvent>,
    @InjectQueue('stripe_webhook_queue')
    private readonly webhookQueue: Queue,
  ) {}

  /**
   * POST /webhooks/stripe
   * Receives Stripe webhook payloads, verifies signature, persists event for deduplication,
   * enqueues processing job, and returns fast 200 OK.
   */
  @Post('stripe')
  async handleStripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature?: string,
  ): Promise<any> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header.');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body buffer.');
    }

    // 1. Signature Verify before any DB write
    let stripeEvent: any;
    try {
      stripeEvent = this.stripeService.constructEvent(
        rawBody as Buffer,
        signature,
      );
    } catch (err: any) {
      throw new BadRequestException(
        err.message || 'Signature verification failed.',
      );
    }

    // 2. Persist event using unique checks for deduplication
    const existing = await this.webhookRepo.findOneBy({
      provider: PaymentProvider.Stripe,
      providerEventId: stripeEvent.id,
    });

    if (existing) {
      // Duplicate delivery -> 200 fast ack
      return { received: true, duplicate: true };
    }

    const eventEntity = new PaymentWebhookEvent();
    eventEntity.provider = PaymentProvider.Stripe;
    eventEntity.providerEventId = stripeEvent.id;
    eventEntity.eventType = stripeEvent.type;
    eventEntity.payload = stripeEvent;

    try {
      const saved = await this.webhookRepo.save(eventEntity);

      // 3. Enqueue to BullMQ processing queue
      await this.webhookQueue.add('process_webhook', { eventId: saved.id });

      return { received: true };
    } catch (err: any) {
      // Database level duplicate key safety check (composite unique constraint ux_payment_webhook_events_provider_event)
      if (err.code === '23505') {
        return { received: true, duplicate: true };
      }
      throw err;
    }
  }
}
