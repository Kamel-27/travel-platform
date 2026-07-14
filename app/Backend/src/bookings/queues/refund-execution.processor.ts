import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';

import { RefundExecutionService } from '../services/refund-execution.service';
import { REFUND_EXECUTION_QUEUE } from './refund-execution.queue';
import { runWithRequestId } from '../../common/logging/request-context';

interface RefundJobData {
  refundId: string;
  requestId?: string;
}

/**
 * Executes pending gateway refunds. Unlike order fulfillment (which must
 * never auto-retry because a Duffel order might have been created), refund
 * execution IS safe to retry: executeRefund() no-ops unless the row is
 * still `pending`, so errors are rethrown to trigger BullMQ's backoff.
 * When the last attempt fails, the row is marked `failed` and surfaces in
 * GET /admin/refunds for manual retry.
 */
@Processor(REFUND_EXECUTION_QUEUE)
export class RefundExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(RefundExecutionProcessor.name);

  constructor(private readonly refundExecutionService: RefundExecutionService) {
    super();
  }

  async process(job: Job<RefundJobData>): Promise<void> {
    return runWithRequestId(job.data.requestId ?? randomUUID(), () =>
      this.processJob(job),
    );
  }

  private async processJob(job: Job<RefundJobData>): Promise<void> {
    const { refundId } = job.data;
    this.logger.log(
      `Executing refund ${refundId} (attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1})`,
    );
    const result = await this.refundExecutionService.executeRefund(refundId);
    if (!result.executed) {
      this.logger.log(`Refund ${refundId} already settled — job is a no-op.`);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<RefundJobData> | undefined,
    err: Error,
  ): Promise<void> {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    // After the Nth failed attempt attemptsMade === N, so this is only true
    // once retries are exhausted.
    if (job.attemptsMade >= maxAttempts) {
      await this.refundExecutionService.markRefundFailed(
        job.data.refundId,
        err.message,
      );
    } else {
      this.logger.warn(
        `Refund ${job.data.refundId} attempt ${job.attemptsMade}/${maxAttempts} failed: ${err.message} — will retry.`,
      );
    }
  }
}
