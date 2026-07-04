import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';

import { OrderFulfillmentService } from '../services/order-fulfillment.service';
import { runWithRequestId } from '../../common/logging/request-context';

@Processor('order_fulfillment_queue')
export class OrderFulfillmentProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderFulfillmentProcessor.name);

  constructor(private readonly fulfillmentService: OrderFulfillmentService) {
    super();
  }

  async process(
    job: Job<{ bookingId: string; requestId?: string }>,
  ): Promise<void> {
    return runWithRequestId(job.data.requestId ?? randomUUID(), () =>
      this.processJob(job),
    );
  }

  private async processJob(job: Job<{ bookingId: string }>): Promise<void> {
    const { bookingId } = job.data;
    this.logger.log(
      `Processing order fulfillment job for booking: ${bookingId}`,
    );

    try {
      await this.fulfillmentService.fulfillOrder(bookingId);
      this.logger.log(
        `Order fulfillment job completed for booking: ${bookingId}`,
      );
    } catch (err: unknown) {
      // Log but do NOT throw — we don't want BullMQ auto-retries for this job.
      // Ambiguous failures must stay in paid and be handled by reconciliation.
      this.logger.error(
        `Order fulfillment job failed for booking ${bookingId}. ` +
          `Error will NOT be retried (reconciliation sweep will handle).`,
        err,
      );
    }
  }
}
