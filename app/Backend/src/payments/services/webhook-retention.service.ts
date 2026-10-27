import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { PaymentWebhookEvent } from '../entities/payment-webhook-event.entity';

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // nfr.md §8: 90-day retention

/**
 * Prunes processed PaymentWebhookEvent rows past the 90-day retention window
 * (nfr.md §8). Never touches unprocessed rows regardless of age — those stay
 * for DuffelWebhookSweepService-style reprocessing/dispute investigation.
 *
 * `transaction.succeeded` rows are kept for good: they are the audit record
 * of money coming in, and the fallback source of the Paymob transaction id
 * for attempts that succeeded before provider_transaction_id existed.
 */
const KEPT_FOREVER_EVENT_TYPE = 'transaction.succeeded';
@Injectable()
export class WebhookRetentionService {
  private readonly logger = new Logger(WebhookRetentionService.name);

  constructor(
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookRepo: Repository<PaymentWebhookEvent>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async pruneOldWebhookEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const result = await this.webhookRepo.delete({
      receivedAt: LessThan(cutoff),
      processedAt: Not(IsNull()),
      eventType: Not(KEPT_FOREVER_EVENT_TYPE),
    });
    if (result.affected) {
      this.logger.log(
        `Pruned ${result.affected} payment webhook event(s) past the 90-day retention window.`,
      );
    }
  }
}
