import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupplierWebhookEvent } from '../entities/supplier-webhook-event.entity';

/**
 * Re-enqueues Duffel webhook events that arrived before the booking/order
 * they reference was resolvable locally (e.g. order.created racing the
 * create-order HTTP call), mirroring PaymentWebhookSweepService.
 */
@Injectable()
export class DuffelWebhookSweepService {
  private readonly logger = new Logger(DuffelWebhookSweepService.name);

  constructor(
    @InjectRepository(SupplierWebhookEvent)
    private readonly eventRepo: Repository<SupplierWebhookEvent>,
    @InjectQueue('duffel_webhook_queue')
    private readonly webhookQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweepUnprocessedWebhooks(): Promise<void> {
    this.logger.debug('Running background Duffel webhook sweep...');

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const unprocessed = await this.eventRepo.find({
      where: {
        processedAt: IsNull(),
        receivedAt: LessThan(oneMinuteAgo),
      },
    });

    if (unprocessed.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${unprocessed.length} unprocessed Duffel webhook events to re-enqueue.`,
    );

    for (const event of unprocessed) {
      try {
        await this.webhookQueue.add('process_duffel_webhook', {
          eventId: event.id,
        });
      } catch (err: unknown) {
        this.logger.error(
          `Failed to re-enqueue Duffel webhook event ${event.id} during sweep:`,
          err,
        );
      }
    }
  }
}
