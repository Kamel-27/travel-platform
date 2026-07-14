/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { RefundExecutionService } from './refund-execution.service';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { Refund, RefundStatus } from '../../payments/entities/refund.entity';

describe('RefundExecutionService', () => {
  let service: RefundExecutionService;
  let paymentRepo: any;
  let refundRepo: any;
  let webhookEventRepo: any;
  let paymobService: any;
  let stateMachine: any;
  let mockManager: any;
  let managerRefundRepo: any;
  let managerBookingRepo: any;
  /** Rows the manager-scoped refund repo "contains" (per test). */
  let refundRows: any[];
  let lastSavedRefund: any;

  const payment = (): Partial<Payment> => ({
    id: 'pay_1',
    bookingId: 'booking_1',
    status: PaymentStatus.Succeeded,
    amount: 1000,
    currency: 'USD',
  });

  const pendingRefund = (): any => ({
    id: 'refund_1',
    paymentId: 'pay_1',
    providerRefundId: null,
    amount: 400,
    currency: 'USD',
    status: RefundStatus.Pending,
    reason: 'customer_cancel',
    initiatedByUserId: 'user_1',
  });

  beforeEach(() => {
    refundRows = [];
    lastSavedRefund = null;

    managerRefundRepo = {
      findBy: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            lastSavedRefund
              ? [...refundRows, lastSavedRefund]
              : [...refundRows],
          ),
        ),
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockImplementation(() => Promise.resolve(lastSavedRefund)),
      }),
    };
    managerBookingRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    const managerPaymentRepo = {
      findOneBy: jest
        .fn()
        .mockImplementation((where: any) => paymentRepo.findOneBy(where)),
    };

    mockManager = {
      save: jest.fn().mockImplementation((cls: unknown, obj: any) => {
        const saved = { ...obj, id: obj.id ?? 'refund_1' };
        if (cls === Refund) lastSavedRefund = saved;
        return Promise.resolve(saved);
      }),
      getRepository: jest.fn().mockImplementation((cls: unknown) => {
        if (cls === Refund) return managerRefundRepo;
        if (cls === Booking) return managerBookingRepo;
        if (cls === Payment) return managerPaymentRepo;
        return { findOneBy: jest.fn().mockResolvedValue(null) };
      }),
    };

    paymentRepo = { findOneBy: jest.fn().mockResolvedValue(payment()) };
    refundRepo = {
      findOneBy: jest.fn().mockResolvedValue(pendingRefund()),
      findBy: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: {
        transaction: jest.fn().mockImplementation((cb: any) => cb(mockManager)),
      },
    };
    webhookEventRepo = {
      findOne: jest.fn().mockResolvedValue({
        paymentId: 'pay_1',
        eventType: 'transaction.succeeded',
        payload: { obj: { id: 987654 } },
      }),
    };
    paymobService = {
      refundTransaction: jest.fn().mockResolvedValue({ refundId: 'rfnd_9' }),
    };
    stateMachine = { transitionTo: jest.fn().mockResolvedValue(undefined) };

    service = new RefundExecutionService(
      paymentRepo,
      refundRepo,
      webhookEventRepo,
      paymobService,
      stateMachine,
    );
  });

  describe('createPendingRefund', () => {
    const params = {
      paymentId: 'pay_1',
      amount: 400,
      reason: 'customer_cancel',
      initiatedByUserId: 'user_1',
    };

    it('throws 404 when the payment does not exist', async () => {
      paymentRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.createPendingRefund(mockManager, params),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects payments that never succeeded', async () => {
      paymentRepo.findOneBy.mockResolvedValue({
        ...payment(),
        status: PaymentStatus.Pending,
      });

      await expect(
        service.createPendingRefund(mockManager, params),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects non-positive amounts', async () => {
      await expect(
        service.createPendingRefund(mockManager, { ...params, amount: 0 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('counts PENDING rows against the refundable balance (no double-commit)', async () => {
      refundRows = [{ amount: 900, status: RefundStatus.Pending }];

      await expect(
        service.createPendingRefund(mockManager, { ...params, amount: 200 }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('writes a pending row with no provider id', async () => {
      const refund = await service.createPendingRefund(mockManager, {
        ...params,
        supplierRefundAmount: 350,
      });

      expect(mockManager.save).toHaveBeenCalledWith(
        Refund,
        expect.objectContaining({
          paymentId: 'pay_1',
          providerRefundId: null,
          amount: 400,
          currency: 'USD',
          status: RefundStatus.Pending,
          supplierRefundAmount: 350,
        }),
      );
      expect(refund.status).toBe(RefundStatus.Pending);
    });
  });

  describe('executeRefund', () => {
    it('throws 404 when the refund does not exist', async () => {
      refundRepo.findOneBy.mockResolvedValue(null);

      await expect(service.executeRefund('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('is a no-op for a non-pending row (idempotent replay, no gateway call)', async () => {
      refundRepo.findOneBy.mockResolvedValue({
        ...pendingRefund(),
        status: RefundStatus.Succeeded,
      });

      const result = await service.executeRefund('refund_1');

      expect(result.executed).toBe(false);
      expect(paymobService.refundTransaction).not.toHaveBeenCalled();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('executes at the gateway and rolls up a partial refund without touching the booking', async () => {
      lastSavedRefund = pendingRefund(); // row the locked re-read returns

      const result = await service.executeRefund('refund_1');

      expect(paymobService.refundTransaction).toHaveBeenCalledWith(987654, 400);
      expect(mockManager.save).toHaveBeenCalledWith(
        Refund,
        expect.objectContaining({
          providerRefundId: 'rfnd_9',
          status: RefundStatus.Succeeded,
        }),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({ status: PaymentStatus.PartiallyRefunded }),
      );
      expect(stateMachine.transitionTo).not.toHaveBeenCalled();
      expect(result.executed).toBe(true);
      expect(result.fullyRefunded).toBe(false);
    });

    it('marks the payment refunded and transitions a cancelled booking on full coverage', async () => {
      const fullRefund = { ...pendingRefund(), amount: 1000 };
      refundRepo.findOneBy.mockResolvedValue(fullRefund);
      lastSavedRefund = fullRefund;
      managerBookingRepo.findOneBy.mockResolvedValue({
        id: 'booking_1',
        status: BookingStatus.Cancelled,
      });

      const result = await service.executeRefund('refund_1');

      expect(mockManager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({ status: PaymentStatus.Refunded }),
      );
      expect(stateMachine.transitionTo).toHaveBeenCalledWith(
        mockManager,
        'booking_1',
        BookingStatus.Refunded,
        'user_1',
        'customer_cancel',
      );
      expect(result.fullyRefunded).toBe(true);
    });

    it('does not record anything when the row settled during the gateway call', async () => {
      // The pre-check sees pending, but the locked re-read finds it already
      // succeeded (another executor won the race).
      refundRepo.findOneBy.mockResolvedValue(pendingRefund());
      lastSavedRefund = {
        ...pendingRefund(),
        status: RefundStatus.Succeeded,
      };

      const result = await service.executeRefund('refund_1');

      expect(paymobService.refundTransaction).toHaveBeenCalled();
      expect(mockManager.save).not.toHaveBeenCalled();
      expect(result.executed).toBe(true);
      expect(result.fullyRefunded).toBe(false);
    });

    it('throws (retryable) when no succeeded gateway transaction is stored', async () => {
      webhookEventRepo.findOne.mockResolvedValue(null);

      await expect(service.executeRefund('refund_1')).rejects.toThrow(
        ConflictException,
      );
      expect(paymobService.refundTransaction).not.toHaveBeenCalled();
    });
  });

  describe('markRefundFailed', () => {
    it('only fails rows that are still pending', async () => {
      await service.markRefundFailed('refund_1', 'gateway down');

      expect(refundRepo.update).toHaveBeenCalledWith(
        { id: 'refund_1', status: RefundStatus.Pending },
        { status: RefundStatus.Failed },
      );
    });
  });
});
