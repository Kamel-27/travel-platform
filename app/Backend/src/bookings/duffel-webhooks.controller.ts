/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Request } from 'express';

import { DuffelService } from '../duffel/duffel.service';
import { SupplierWebhookEvent } from './entities/supplier-webhook-event.entity';
import { Supplier } from './entities/booking.entity';

/**
 * Duffel order-lifecycle webhooks (order.created, schedule changes).
 * Lives in BookingsModule (not PaymentsModule/WebhooksController) since
 * processing depends on the booking state machine and DuffelService,
 * mirroring the architecture note in duffel_api_integration_guide.md
 * ("DuffelWebhookController").
 */
@Controller('webhooks')
export class DuffelWebhooksController {
  constructor(
    private readonly duffelService: DuffelService,
    @InjectRepository(SupplierWebhookEvent)
    private readonly eventRepo: Repository<SupplierWebhookEvent>,
    @InjectQueue('duffel_webhook_queue')
    private readonly webhookQueue: Queue,
  ) {}

  /**
   * POST /webhooks/duffel
   * Verifies the X-Duffel-Signature header against the raw body before any
   * DB write, dedupes on the event id, acks fast, and queues processing.
   */
  @Post('duffel')
  async handleDuffelWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-duffel-signature') signature?: string,
  ): Promise<{ received: boolean; duplicate?: boolean }> {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));

    if (!this.duffelService.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Duffel signature verification failed.');
    }

    const body = req.body as Record<string, any>;
    const eventId = body?.id as string | undefined;
    const eventType = body?.type as string | undefined;
    // Duffel's `idempotency_key` on the webhook envelope is the related
    // resource's own id (ord_…), not a per-event key — see duffel.service.ts.
    const resourceId = (body?.idempotency_key as string | undefined) ?? null;

    if (!eventId || !eventType) {
      throw new BadRequestException('Malformed Duffel webhook payload.');
    }

    const existing = await this.eventRepo.findOneBy({
      supplier: Supplier.Duffel,
      supplierEventId: eventId,
    });
    if (existing) {
      return { received: true, duplicate: true };
    }

    const event = new SupplierWebhookEvent();
    event.supplier = Supplier.Duffel;
    event.supplierEventId = eventId;
    event.supplierResourceId = resourceId;
    event.eventType = eventType;
    event.payload = body;

    try {
      const saved = await this.eventRepo.save(event);
      await this.webhookQueue.add('process_duffel_webhook', {
        eventId: saved.id,
      });
      return { received: true };
    } catch (err: any) {
      if (err.code === '23505') {
        // Duplicate delivery raced past the findOneBy check above.
        return { received: true, duplicate: true };
      }
      throw err;
    }
  }
}
