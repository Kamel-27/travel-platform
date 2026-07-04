/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

import { WebhooksController } from './webhooks.controller';
import { StripeService } from './services/stripe.service';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let stripeService: StripeService;
  let mockWebhookRepo: any;
  let mockQueue: any;

  const mockStripeEvent = {
    id: 'evt_123',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_123',
        amount: 10500,
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
          provide: StripeService,
          useValue: {
            constructEvent: jest.fn().mockReturnValue(mockStripeEvent),
          },
        },
        {
          provide: getRepositoryToken(PaymentWebhookEvent),
          useValue: mockWebhookRepo,
        },
        {
          provide: getQueueToken('stripe_webhook_queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    stripeService = module.get<StripeService>(StripeService);
  });

  describe('handleStripeWebhook', () => {
    it('should successfully verify signature, save event and enqueue BullMQ job', async () => {
      const mockReq: any = { rawBody: Buffer.from('payload') };

      const result = await controller.handleStripeWebhook(mockReq, 'sig_123');

      expect(stripeService.constructEvent).toHaveBeenCalledWith(
        mockReq.rawBody,
        'sig_123',
      );
      expect(mockWebhookRepo.findOneBy).toHaveBeenCalled();
      expect(mockWebhookRepo.save).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith('process_webhook', {
        eventId: 'db_evt_123',
      });
      expect(result).toEqual({ received: true });
    });

    it('should throw BadRequestException if signature header is missing', async () => {
      const mockReq: any = { rawBody: Buffer.from('payload') };
      await expect(
        controller.handleStripeWebhook(mockReq, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if rawBody is missing', async () => {
      const mockReq: any = {};
      await expect(
        controller.handleStripeWebhook(mockReq, 'sig_123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return received: true and duplicate: true on double delivery detection', async () => {
      mockWebhookRepo.findOneBy.mockResolvedValueOnce({ id: 'db_evt_123' });
      const mockReq: any = { rawBody: Buffer.from('payload') };

      const result = await controller.handleStripeWebhook(mockReq, 'sig_123');

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true, duplicate: true });
    });
  });
});
