/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

import { DuffelWebhooksController } from './duffel-webhooks.controller';
import { DuffelService } from '../duffel/duffel.service';
import { SupplierWebhookEvent } from './entities/supplier-webhook-event.entity';
import { Supplier } from './entities/booking.entity';

function makeReq(body: Record<string, unknown>): any {
  return {
    body,
    rawBody: Buffer.from(JSON.stringify(body)),
  };
}

describe('DuffelWebhooksController', () => {
  let controller: DuffelWebhooksController;
  let duffelService: DuffelService;
  let mockEventRepo: any;
  let mockQueue: any;

  const mockBody = {
    id: 'wev_00001',
    type: 'order.created',
    idempotency_key: 'ord_00001',
  };

  beforeEach(async () => {
    mockEventRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest
        .fn()
        .mockImplementation((val) =>
          Promise.resolve({ ...val, id: 'db_evt_123' }),
        ),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job_123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DuffelWebhooksController],
      providers: [
        {
          provide: DuffelService,
          useValue: {
            verifyWebhookSignature: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: getRepositoryToken(SupplierWebhookEvent),
          useValue: mockEventRepo,
        },
        {
          provide: getQueueToken('duffel_webhook_queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    controller = module.get<DuffelWebhooksController>(DuffelWebhooksController);
    duffelService = module.get<DuffelService>(DuffelService);
  });

  describe('handleDuffelWebhook', () => {
    it('verifies signature, persists event and enqueues a job', async () => {
      const result = await controller.handleDuffelWebhook(
        makeReq(mockBody),
        't=1,v1=abc',
      );

      expect(duffelService.verifyWebhookSignature).toHaveBeenCalled();
      expect(mockEventRepo.findOneBy).toHaveBeenCalledWith({
        supplier: Supplier.Duffel,
        supplierEventId: 'wev_00001',
      });
      expect(mockEventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierEventId: 'wev_00001',
          supplierResourceId: 'ord_00001',
          eventType: 'order.created',
        }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith('process_duffel_webhook', {
        eventId: 'db_evt_123',
      });
      expect(result).toEqual({ received: true });
    });

    it('rejects when signature verification fails — no DB write', async () => {
      jest
        .spyOn(duffelService, 'verifyWebhookSignature')
        .mockReturnValueOnce(false);

      await expect(
        controller.handleDuffelWebhook(makeReq(mockBody), 't=1,v1=bad'),
      ).rejects.toThrow(BadRequestException);

      expect(mockEventRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a malformed payload missing id/type', async () => {
      await expect(
        controller.handleDuffelWebhook(makeReq({ foo: 'bar' }), 't=1,v1=abc'),
      ).rejects.toThrow(BadRequestException);
    });

    it('acks a duplicate delivery without re-enqueueing', async () => {
      mockEventRepo.findOneBy.mockResolvedValueOnce({ id: 'db_evt_123' });

      const result = await controller.handleDuffelWebhook(
        makeReq(mockBody),
        't=1,v1=abc',
      );

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true, duplicate: true });
    });
  });
});
