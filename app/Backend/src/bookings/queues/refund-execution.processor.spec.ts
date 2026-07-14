/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { RefundExecutionProcessor } from './refund-execution.processor';

describe('RefundExecutionProcessor', () => {
  let processor: RefundExecutionProcessor;
  let refundExecutionService: any;

  beforeEach(() => {
    refundExecutionService = {
      executeRefund: jest.fn().mockResolvedValue({ executed: true }),
      markRefundFailed: jest.fn().mockResolvedValue(undefined),
    };
    processor = new RefundExecutionProcessor(refundExecutionService);
  });

  const job = (attemptsMade: number, attempts = 5): any => ({
    data: { refundId: 'refund_1' },
    attemptsMade,
    opts: { attempts },
  });

  it('executes the refund and propagates errors so BullMQ retries', async () => {
    refundExecutionService.executeRefund.mockRejectedValue(
      new Error('gateway down'),
    );

    await expect(processor.process(job(0))).rejects.toThrow('gateway down');
    expect(refundExecutionService.executeRefund).toHaveBeenCalledWith(
      'refund_1',
    );
  });

  it('does not mark the row failed while retries remain', async () => {
    await processor.onFailed(job(2), new Error('gateway down'));

    expect(refundExecutionService.markRefundFailed).not.toHaveBeenCalled();
  });

  it('marks the row failed once the final attempt fails', async () => {
    await processor.onFailed(job(5), new Error('gateway down'));

    expect(refundExecutionService.markRefundFailed).toHaveBeenCalledWith(
      'refund_1',
      'gateway down',
    );
  });
});
