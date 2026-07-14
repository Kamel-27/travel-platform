import type { JobsOptions } from 'bullmq';

export const REFUND_EXECUTION_QUEUE = 'refund_execution_queue';
export const REFUND_EXECUTION_JOB = 'execute_refund';

/**
 * Retry policy for gateway refund execution: 5 attempts, exponential
 * backoff from 30s (30s → 1m → 2m → 4m → 8m). The jobId is derived from the
 * refund row so a refund can never have two live jobs at once; removeOnFail
 * frees the id after the final attempt so POST /admin/refunds/:id/retry can
 * re-enqueue it.
 */
export function refundExecutionJobOptions(refundId: string): JobsOptions {
  return {
    jobId: `refund:${refundId}`,
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: true,
    removeOnFail: true,
  };
}
