/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { PaymobService } from './services/paymob.service';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { PaymentProvider } from './entities/payment.entity';
import { getRequestId } from '../common/logging/request-context';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly paymobService: PaymobService,
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookRepo: Repository<PaymentWebhookEvent>,
    @InjectQueue('payment_webhook_queue')
    private readonly webhookQueue: Queue,
  ) {}

  /**
   * POST /webhooks/paymob
   * Receives Paymob transaction-processed callbacks, verifies the HMAC
   * (sent as a query param), persists the event for deduplication,
   * enqueues a processing job, and returns a fast 200 OK.
   */
  @Post('paymob')
  async handlePaymobWebhook(
    @Body() body: any,
    @Query('hmac') hmac?: string,
  ): Promise<any> {
    // Only transaction callbacks are relevant (and HMAC-verifiable with the
    // transaction field set); acknowledge and ignore other callback types.
    if (body?.type !== 'TRANSACTION' || !body.obj) {
      return { received: true, ignored: true };
    }

    const transaction = body.obj as Record<string, any>;

    // 1. HMAC verify before any DB write
    if (!this.paymobService.verifyTransactionHmac(transaction, hmac)) {
      throw new BadRequestException('HMAC verification failed.');
    }

    // Derive a semantic event type from the transaction flags
    const eventType = transaction.pending
      ? 'transaction.pending'
      : transaction.success
        ? 'transaction.succeeded'
        : 'transaction.failed';

    // Paymob has no distinct event id; a transaction can legitimately emit
    // callbacks in different states, so dedupe on (id, state) — exact
    // redeliveries collapse, state progressions are kept.
    const providerEventId = `${transaction.id}:${eventType}`;

    // 2. Persist event using unique checks for deduplication
    const existing = await this.webhookRepo.findOneBy({
      provider: PaymentProvider.Paymob,
      providerEventId,
    });

    if (existing) {
      // Duplicate delivery -> 200 fast ack
      return { received: true, duplicate: true };
    }

    const eventEntity = new PaymentWebhookEvent();
    eventEntity.provider = PaymentProvider.Paymob;
    eventEntity.providerEventId = providerEventId;
    eventEntity.eventType = eventType;
    eventEntity.payload = body;

    try {
      const saved = await this.webhookRepo.save(eventEntity);

      // 3. Enqueue to BullMQ processing queue — carry request_id so the
      // worker's logs correlate back to this inbound call (nfr.md §7).
      await this.webhookQueue.add('process_webhook', {
        eventId: saved.id,
        requestId: getRequestId(),
      });

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
