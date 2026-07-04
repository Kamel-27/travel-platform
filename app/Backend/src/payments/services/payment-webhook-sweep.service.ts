import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PaymentWebhookEvent } from '../entities/payment-webhook-event.entity';

@Injectable()
export class PaymentWebhookSweepService {
  private readonly logger = new Logger(PaymentWebhookSweepService.name);

  constructor(
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookRepo: Repository<PaymentWebhookEvent>,
    @InjectQueue('payment_webhook_queue')
    private readonly webhookQueue: Queue,
  ) {}

  /**
   * Sweeps for payment webhook events that have been received but not successfully processed
   * (e.g. due to temporary worker crashes or DB locks), enqueuing them back into the queue.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepUnprocessedWebhooks(): Promise<void> {
    this.logger.debug('Running background payment webhook sweep...');

    // Find unprocessed events received at least 1 minute ago to allow regular worker execution
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const unprocessed = await this.webhookRepo.find({
      where: {
        processedAt: IsNull(),
        receivedAt: LessThan(oneMinuteAgo),
      },
    });

    if (unprocessed.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${unprocessed.length} unprocessed webhook events to re-enqueue.`,
    );

    for (const event of unprocessed) {
      try {
        await this.webhookQueue.add('process_webhook', { eventId: event.id });
        this.logger.log(
          `Re-enqueued webhook event ${event.id} for processing.`,
        );
      } catch (err: unknown) {
        this.logger.error(
          `Failed to re-enqueue webhook event ${event.id} during sweep:`,
          err,
        );
      }
    }
  }
}
