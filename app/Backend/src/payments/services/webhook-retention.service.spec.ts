/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { WebhookRetentionService } from './webhook-retention.service';
import { PaymentWebhookEvent } from '../entities/payment-webhook-event.entity';

describe('WebhookRetentionService', () => {
  let service: WebhookRetentionService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookRetentionService,
        {
          provide: getRepositoryToken(PaymentWebhookEvent),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get(WebhookRetentionService);
  });

  it('prunes only processed events older than 90 days', async () => {
    await service.pruneOldWebhookEvents();

    const call = mockRepo.delete.mock.calls[0][0];
    expect(call.processedAt._type).toBe('not');
    const cutoff = call.receivedAt._value as Date;
    const expectedCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5000);
  });
});
