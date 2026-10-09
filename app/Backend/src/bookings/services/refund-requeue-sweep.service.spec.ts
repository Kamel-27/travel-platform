/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { RefundRequeueSweepService } from './refund-requeue-sweep.service';
import { FulfillmentOutcomeService } from './fulfillment-outcome.service';
import { Refund, RefundStatus } from '../../payments/entities/refund.entity';

describe('RefundRequeueSweepService', () => {
  let service: RefundRequeueSweepService;
  let refundRepo: any;
  let outcome: any;

  beforeEach(async () => {
    refundRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundRequeueSweepService,
        { provide: getRepositoryToken(Refund), useValue: refundRepo },
        {
          provide: FulfillmentOutcomeService,
          useValue: { enqueueRefund: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(RefundRequeueSweepService);
    outcome = module.get(FulfillmentOutcomeService);
  });

  it('re-enqueues every stale pending refund', async () => {
    refundRepo.find.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);

    await service.requeueStalePendingRefunds();

    expect(refundRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: RefundStatus.Pending }),
      }),
    );
    expect(outcome.enqueueRefund).toHaveBeenCalledWith('r1');
    expect(outcome.enqueueRefund).toHaveBeenCalledWith('r2');
  });

  it('does nothing when no refund is stuck', async () => {
    await service.requeueStalePendingRefunds();

    expect(outcome.enqueueRefund).not.toHaveBeenCalled();
  });
});
