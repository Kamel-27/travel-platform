import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { Refund, RefundStatus } from '../../payments/entities/refund.entity';
import { FulfillmentOutcomeService } from './fulfillment-outcome.service';

/**
 * Safety net for refunds that are `pending` but have no live job — a Redis
 * blip at enqueue time, or rows written before every system refund path
 * enqueued its own job. Same `processed_at IS NULL`-style sweep the webhook
 * pipelines use.
 *
 * Re-enqueueing is safe: the jobId is derived from the refund id (BullMQ
 * ignores a duplicate while one is live) and executeRefund no-ops on any row
 * that is not pending. The age threshold keeps it clear of admin refunds
 * that are executed inline within the same request.
 */
@Injectable()
export class RefundRequeueSweepService {
  private readonly logger = new Logger(RefundRequeueSweepService.name);

  private readonly MIN_AGE_MS = 5 * 60 * 1000;
  private readonly BATCH_SIZE = 100;

  constructor(
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    private readonly fulfillmentOutcome: FulfillmentOutcomeService,
  ) {}

  @Cron('*/5 * * * *')
  async requeueStalePendingRefunds(): Promise<void> {
    const cutoff = new Date(Date.now() - this.MIN_AGE_MS);
    const stale = await this.refundRepo.find({
      where: { status: RefundStatus.Pending, createdAt: LessThan(cutoff) },
      order: { createdAt: 'ASC' },
      take: this.BATCH_SIZE,
    });

    if (stale.length === 0) {
      return;
    }

    this.logger.warn(
      `Re-enqueueing ${stale.length} pending refund(s) older than 5 minutes`,
    );
    for (const refund of stale) {
      await this.fulfillmentOutcome.enqueueRefund(refund.id);
    }
  }
}
