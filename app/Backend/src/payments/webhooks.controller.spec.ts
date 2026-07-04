/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

import { WebhooksController } from './webhooks.controller';
import { PaymobService } from './services/paymob.service';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let paymobService: PaymobService;
  let mockWebhookRepo: any;
  let mockQueue: any;

  const mockPaymobBody = {
    type: 'TRANSACTION',
    obj: {
      id: 99999,
      pending: false,
      success: true,
      amount_cents: 10500,
      order: {
        id: 12345,
      },
    },
  };

  beforeEach(async () => {
    mockWebhookRepo = {
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
      controllers: [WebhooksController],
      providers: [
        {
          provide: PaymobService,
          useValue: {
            verifyTransactionHmac: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: getRepositoryToken(PaymentWebhookEvent),
          useValue: mockWebhookRepo,
        },
        {
          provide: getQueueToken('payment_webhook_queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    paymobService = module.get<PaymobService>(PaymobService);
  });

  describe('handlePaymobWebhook', () => {
    it('should successfully verify signature, save event and enqueue BullMQ job', async () => {
      const result = await controller.handlePaymobWebhook(
        mockPaymobBody,
        'hmac_123',
      );

      expect(paymobService.verifyTransactionHmac).toHaveBeenCalledWith(
        mockPaymobBody.obj,
        'hmac_123',
      );
      expect(mockWebhookRepo.findOneBy).toHaveBeenCalled();
      expect(mockWebhookRepo.save).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith('process_webhook', {
        eventId: 'db_evt_123',
      });
      expect(result).toEqual({ received: true });
    });

    it('should throw BadRequestException if HMAC verification fails', async () => {
      jest
        .spyOn(paymobService, 'verifyTransactionHmac')
        .mockReturnValueOnce(false);
      await expect(
        controller.handlePaymobWebhook(mockPaymobBody, 'hmac_123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should ignore non-TRANSACTION event types silently', async () => {
      const otherBody = { type: 'TOKEN', obj: {} };
      const result = await controller.handlePaymobWebhook(
        otherBody,
        'hmac_123',
      );

      expect(paymobService.verifyTransactionHmac).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true, ignored: true });
    });

    it('should return received: true and duplicate: true on double delivery detection', async () => {
      mockWebhookRepo.findOneBy.mockResolvedValueOnce({ id: 'db_evt_123' });

      const result = await controller.handlePaymobWebhook(
        mockPaymobBody,
        'hmac_123',
      );

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true, duplicate: true });
    });
  });
});
