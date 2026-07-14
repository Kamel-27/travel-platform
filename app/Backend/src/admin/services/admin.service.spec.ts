/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';

import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';
import { DuffelService } from '../../duffel/duffel.service';
import { PaymobService } from '../../payments/services/paymob.service';
import { BookingStateMachineService } from '../../bookings/services/booking-state-machine.service';
import { RefundExecutionService } from '../../bookings/services/refund-execution.service';
import { Booking, BookingStatus } from '../../bookings/entities/booking.entity';
import {
  MarkupRule,
  MarkupType,
} from '../../bookings/entities/markup-rule.entity';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { PaymentWebhookEvent } from '../../payments/entities/payment-webhook-event.entity';
import { Refund, RefundStatus } from '../../payments/entities/refund.entity';
import { User, UserRole } from '../../users/user.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { AuditLog } from '../entities/audit-log.entity';

const ADMIN_ID = 'admin_user_001';

describe('AdminService', () => {
  let service: AdminService;
  let mockEntityManager: any;
  let mockManager: any;
  let mockBookingRepo: any;
  let mockPaymentRepo: any;
  let mockRefundRepo: any;
  let mockMarkupRuleRepo: any;
  let mockWebhookEventRepo: any;
  let duffelService: any;
  let paymobService: any;
  let stateMachine: any;
  let auditLogService: any;
  let mockManagerMarkupRepo: any;

  const confirmedBooking: Partial<Booking> = {
    id: 'booking_001',
    userId: 'user_001',
    status: BookingStatus.Confirmed,
    supplierOrderId: 'ord_duffel_001',
    bookingReference: 'ABC123',
    baseAmount: 100000,
    markupAmount: 5000,
    totalAmount: 105000,
    currency: 'USD',
  };

  const succeededPayment: Partial<Payment> = {
    id: 'pay_001',
    bookingId: 'booking_001',
    status: PaymentStatus.Succeeded,
    amount: 105000,
    currency: 'USD',
  };

  const succeededWebhookEvent: Partial<PaymentWebhookEvent> = {
    id: 'evt_001',
    paymentId: 'pay_001',
    eventType: 'transaction.succeeded',
    payload: { obj: { id: 987654 } },
  };

  const regularUser: Partial<User> = {
    id: 'user_001',
    email: 'customer@example.com',
    fullName: 'Jane Doe',
    phone: '+201000000000',
    role: UserRole.User,
    isActive: true,
  };

  let mockUserRepo: any;
  let mockAuditLogRepo: any;
  let mockManagerUserRepo: any;
  let mockManagerRefreshTokenRepo: any;
  let mockManagerBookingRepo: any;
  let mockManagerRefundRepo: any;
  let mockRefundQueue: any;
  /** Rows pre-existing in the refunds table (per test). */
  let managerRefundRows: any[];
  /** The last Refund row written through the transaction manager. */
  let lastSavedRefund: any;

  beforeEach(async () => {
    managerRefundRows = [];
    lastSavedRefund = null;
    mockBookingRepo = {
      findOneBy: jest.fn().mockResolvedValue(confirmedBooking),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      countBy: jest.fn().mockResolvedValue(0),
    };
    mockPaymentRepo = {
      findOneBy: jest.fn().mockResolvedValue({ ...succeededPayment }),
    };
    mockRefundRepo = {
      findBy: jest.fn().mockResolvedValue([]),
      // executeRefund re-reads the row the service just created.
      findOneBy: jest
        .fn()
        .mockImplementation(() => Promise.resolve(lastSavedRefund)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      manager: {
        transaction: jest.fn().mockImplementation((cb: any) => cb(mockManager)),
      },
    };
    mockMarkupRuleRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockWebhookEventRepo = {
      findOne: jest.fn().mockResolvedValue(succeededWebhookEvent),
      countBy: jest.fn().mockResolvedValue(0),
    };

    mockUserRepo = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      count: jest.fn().mockResolvedValue(0),
      countBy: jest.fn().mockResolvedValue(0),
    };
    mockAuditLogRepo = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    mockManagerMarkupRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockManagerBookingRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    mockManagerUserRepo = {
      findOneBy: jest.fn().mockResolvedValue({ ...regularUser }),
    };
    mockManagerRefreshTokenRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    // RefundExecutionService reads/writes Payment and Refund through the
    // transaction manager, not the direct-injected repos above.
    const mockManagerPaymentRepo = {
      // Delegates to the service-level mock so a test override applies to
      // both lookups (AdminService pre-check and createPendingRefund).
      findOneBy: jest
        .fn()
        .mockImplementation((where: unknown) =>
          mockPaymentRepo.findOneBy(where),
        ),
    };
    mockManagerRefundRepo = {
      // Returns pre-existing rows plus whatever the test just wrote, so the
      // post-save rollup in executeRefund sees the freshly-succeeded row.
      findBy: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            lastSavedRefund
              ? [...managerRefundRows, lastSavedRefund]
              : [...managerRefundRows],
          ),
        ),
      // executeRefund re-reads the pending row under lock.
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockImplementation(() => Promise.resolve(lastSavedRefund)),
      }),
    };

    mockManager = {
      save: jest
        .fn()
        .mockImplementation((cls: unknown, obj: Record<string, unknown>) => {
          const saved = { ...obj, id: obj['id'] ?? 'generated_id' };
          if (cls === Refund) lastSavedRefund = saved;
          return Promise.resolve(saved);
        }),
      getRepository: jest.fn().mockImplementation((cls: unknown) => {
        if (cls === MarkupRule) return mockManagerMarkupRepo;
        if (cls === Booking) return mockManagerBookingRepo;
        if (cls === User) return mockManagerUserRepo;
        if (cls === RefreshToken) return mockManagerRefreshTokenRepo;
        if (cls === Payment) return mockManagerPaymentRepo;
        if (cls === Refund) return mockManagerRefundRepo;
        return { findOneBy: jest.fn().mockResolvedValue(null) };
      }),
    };

    mockEntityManager = {
      transaction: jest
        .fn()
        .mockImplementation((cb: (m: unknown) => unknown) => cb(mockManager)),
    };

    duffelService = {
      cancelOrder: jest.fn().mockResolvedValue({ refundAmount: 90000 }),
      getMetrics: jest.fn().mockResolvedValue({
        configured: true,
        requestsLastHour: 42,
        errorsLastHour: 2,
        recentErrorRate: 0.0476,
      }),
    };
    paymobService = {
      refundTransaction: jest.fn().mockResolvedValue({ refundId: 'rfnd_123' }),
    };
    stateMachine = {
      transitionTo: jest.fn().mockResolvedValue(undefined),
    };
    auditLogService = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: EntityManager, useValue: mockEntityManager },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Refund), useValue: mockRefundRepo },
        {
          provide: getRepositoryToken(MarkupRule),
          useValue: mockMarkupRuleRepo,
        },
        {
          provide: getRepositoryToken(PaymentWebhookEvent),
          useValue: mockWebhookEventRepo,
        },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
        { provide: DuffelService, useValue: duffelService },
        { provide: PaymobService, useValue: paymobService },
        { provide: BookingStateMachineService, useValue: stateMachine },
        { provide: AuditLogService, useValue: auditLogService },
        {
          provide: getQueueToken('payment_webhook_queue'),
          useValue: { getFailedCount: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: getQueueToken('order_fulfillment_queue'),
          useValue: { getFailedCount: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: getQueueToken('refund_execution_queue'),
          useValue: (mockRefundQueue = {
            add: jest.fn().mockResolvedValue({}),
          }),
        },
        // Real instance — it's the extracted-and-shared logic under test
        // here too, wired to the same mock repos/gateway/state-machine.
        RefundExecutionService,
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── users ─────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('applies email/role/is_active filters and maps rows', async () => {
      mockUserRepo.findAndCount.mockResolvedValue([
        [{ ...regularUser, createdAt: new Date() }],
        1,
      ]);

      const result = await service.listUsers({
        email: 'customer@example.com',
        role: UserRole.User,
        is_active: true,
        limit: 5,
      });

      expect(mockUserRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email: 'customer@example.com',
            role: UserRole.User,
            isActive: true,
          },
          take: 5,
        }),
      );
      expect(result.total).toBe(1);
      expect(result.users[0]).toMatchObject({
        id: 'user_001',
        email: 'customer@example.com',
        is_active: true,
      });
    });
  });

  describe('updateUser', () => {
    it('throws 404 when the user does not exist', async () => {
      mockManagerUserRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateUser(ADMIN_ID, 'missing', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an admin deactivating their own account', async () => {
      await expect(
        service.updateUser(ADMIN_ID, ADMIN_ID, false),
      ).rejects.toThrow(ConflictException);
      expect(mockEntityManager.transaction).not.toHaveBeenCalled();
    });

    it('deactivation revokes refresh tokens and writes the audit row', async () => {
      const result = await service.updateUser(ADMIN_ID, 'user_001', false);

      expect(mockManager.save).toHaveBeenCalledWith(
        User,
        expect.objectContaining({ id: 'user_001', isActive: false }),
      );
      expect(mockManagerRefreshTokenRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user_001' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        mockManager,
        ADMIN_ID,
        'user.update',
        'user',
        'user_001',
        { is_active: false },
      );
      expect(result).toMatchObject({ id: 'user_001', is_active: false });
    });

    it('reactivation does not touch refresh tokens', async () => {
      mockManagerUserRepo.findOneBy.mockResolvedValue({
        ...regularUser,
        isActive: false,
      });

      const result = await service.updateUser(ADMIN_ID, 'user_001', true);

      expect(mockManagerRefreshTokenRepo.update).not.toHaveBeenCalled();
      expect(result).toMatchObject({ is_active: true });
    });
  });

  // ── listBookings ──────────────────────────────────────────────

  describe('listBookings', () => {
    it('applies status/user/reference filters and maps rows', async () => {
      const row = {
        ...confirmedBooking,
        user: { email: 'customer@example.com' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockBookingRepo.findAndCount.mockResolvedValue([[row], 1]);

      const result = await service.listBookings({
        status: BookingStatus.Confirmed,
        user_id: 'user_001',
        reference: 'ABC123',
        limit: 5,
        offset: 10,
      });

      expect(mockBookingRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: BookingStatus.Confirmed,
            userId: 'user_001',
            bookingReference: 'ABC123',
          },
          take: 5,
          skip: 10,
        }),
      );
      expect(result.total).toBe(1);
      expect(result.bookings[0]).toMatchObject({
        id: 'booking_001',
        user_email: 'customer@example.com',
        booking_reference: 'ABC123',
        total_amount: 105000,
      });
    });
  });

  // ── cancelBooking ─────────────────────────────────────────────

  describe('cancelBooking', () => {
    it('throws 404 when the booking does not exist', async () => {
      mockBookingRepo.findOneBy.mockResolvedValue(null);

      await expect(service.cancelBooking(ADMIN_ID, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects bookings that are not confirmed', async () => {
      mockBookingRepo.findOneBy.mockResolvedValue({
        ...confirmedBooking,
        status: BookingStatus.Paid,
      });

      await expect(
        service.cancelBooking(ADMIN_ID, 'booking_001'),
      ).rejects.toThrow(ConflictException);
      expect(duffelService.cancelOrder).not.toHaveBeenCalled();
    });

    it('cancels at Duffel, transitions T7, commits the pending customer refund, and enqueues execution', async () => {
      const result = await service.cancelBooking(
        ADMIN_ID,
        'booking_001',
        'complex fare',
      );

      expect(duffelService.cancelOrder).toHaveBeenCalledWith('ord_duffel_001');
      expect(stateMachine.transitionTo).toHaveBeenCalledWith(
        mockManager,
        'booking_001',
        BookingStatus.Cancelled,
        ADMIN_ID,
        'complex fare',
      );
      // Customer refund policy: supplier refund (90000) + full markup (5000),
      // committed as a pending row in the same transaction.
      expect(mockManager.save).toHaveBeenCalledWith(
        Refund,
        expect.objectContaining({
          paymentId: 'pay_001',
          amount: 95000,
          status: RefundStatus.Pending,
          providerRefundId: null,
          initiatedByUserId: ADMIN_ID,
        }),
      );
      expect(mockRefundQueue.add).toHaveBeenCalledWith(
        'execute_refund',
        expect.objectContaining({ refundId: 'generated_id' }),
        expect.objectContaining({ jobId: 'refund:generated_id', attempts: 5 }),
      );
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        mockManager,
        ADMIN_ID,
        'booking.cancel',
        'booking',
        'booking_001',
        expect.objectContaining({
          supplier_refund_amount: 90000,
          refund_id: 'generated_id',
          customer_receives_amount: 95000,
        }),
      );
      expect(result).toMatchObject({
        status: BookingStatus.Cancelled,
        supplier_refund_amount: 90000,
        refund: { id: 'generated_id', status: RefundStatus.Pending },
      });
    });

    it('still cancels (without a refund row) when the payment is not refundable', async () => {
      mockPaymentRepo.findOneBy.mockResolvedValue({
        ...succeededPayment,
        status: PaymentStatus.Pending,
      });

      const result = await service.cancelBooking(ADMIN_ID, 'booking_001');

      expect(stateMachine.transitionTo).toHaveBeenCalled();
      expect(mockManager.save).not.toHaveBeenCalledWith(
        Refund,
        expect.anything(),
      );
      expect(mockRefundQueue.add).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        status: BookingStatus.Cancelled,
        refund: null,
      });
    });

    it('leaves the booking untouched when Duffel cancellation fails', async () => {
      duffelService.cancelOrder.mockRejectedValue(new Error('duffel down'));

      await expect(
        service.cancelBooking(ADMIN_ID, 'booking_001'),
      ).rejects.toThrow('duffel down');
      expect(stateMachine.transitionTo).not.toHaveBeenCalled();
      expect(auditLogService.logAction).not.toHaveBeenCalled();
      expect(mockRefundQueue.add).not.toHaveBeenCalled();
    });
  });

  // ── refundPayment ─────────────────────────────────────────────

  describe('refundPayment', () => {
    it('throws 404 when the payment does not exist', async () => {
      mockPaymentRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.refundPayment(ADMIN_ID, 'missing', 1000),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects payments that never succeeded', async () => {
      mockPaymentRepo.findOneBy.mockResolvedValue({
        ...succeededPayment,
        status: PaymentStatus.Pending,
      });

      await expect(
        service.refundPayment(ADMIN_ID, 'pay_001', 1000),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects refunds exceeding the remaining refundable amount', async () => {
      managerRefundRows = [{ amount: 100000, status: RefundStatus.Succeeded }];

      await expect(
        service.refundPayment(ADMIN_ID, 'pay_001', 10000),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(paymobService.refundTransaction).not.toHaveBeenCalled();
      expect(mockRefundQueue.add).not.toHaveBeenCalled();
    });

    it('marks the pending row failed when no succeeded gateway transaction can be located', async () => {
      mockWebhookEventRepo.findOne.mockResolvedValue(null);

      await expect(
        service.refundPayment(ADMIN_ID, 'pay_001', 1000),
      ).rejects.toThrow(ConflictException);
      expect(paymobService.refundTransaction).not.toHaveBeenCalled();
      // The pending row survives as failed — visible and retryable.
      expect(mockRefundRepo.update).toHaveBeenCalledWith(
        { id: 'generated_id', status: RefundStatus.Pending },
        { status: RefundStatus.Failed },
      );
    });

    it('marks the pending row failed and rethrows when the gateway rejects', async () => {
      paymobService.refundTransaction.mockRejectedValue(
        new Error('paymob down'),
      );

      await expect(
        service.refundPayment(ADMIN_ID, 'pay_001', 1000),
      ).rejects.toThrow('paymob down');
      expect(mockRefundRepo.update).toHaveBeenCalledWith(
        { id: 'generated_id', status: RefundStatus.Pending },
        { status: RefundStatus.Failed },
      );
    });

    it('executes a partial refund without touching the booking', async () => {
      const result = await service.refundPayment(
        ADMIN_ID,
        'pay_001',
        50000,
        'goodwill',
      );

      // Pending row committed before the gateway call
      expect(mockManager.save).toHaveBeenCalledWith(
        Refund,
        expect.objectContaining({
          paymentId: 'pay_001',
          providerRefundId: null,
          amount: 50000,
          status: RefundStatus.Pending,
          initiatedByUserId: ADMIN_ID,
        }),
      );
      expect(paymobService.refundTransaction).toHaveBeenCalledWith(
        987654,
        50000,
      );
      // Row settled as succeeded with the provider id
      expect(mockManager.save).toHaveBeenCalledWith(
        Refund,
        expect.objectContaining({
          providerRefundId: 'rfnd_123',
          status: RefundStatus.Succeeded,
        }),
      );
      // Payment rolled up to partially_refunded
      expect(mockManager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({
          status: PaymentStatus.PartiallyRefunded,
        }),
      );
      expect(stateMachine.transitionTo).not.toHaveBeenCalled();
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        mockManager,
        ADMIN_ID,
        'payment.refund',
        'payment',
        'pay_001',
        expect.objectContaining({ amount: 50000, reason: 'goodwill' }),
      );
      expect(result).toMatchObject({
        status: RefundStatus.Succeeded,
        payment_status: PaymentStatus.PartiallyRefunded,
        fully_refunded: false,
      });
    });

    it('marks the payment refunded and transitions a cancelled booking on full refund', async () => {
      mockManagerBookingRepo.findOneBy.mockResolvedValue({
        ...confirmedBooking,
        status: BookingStatus.Cancelled,
      });

      const result = await service.refundPayment(ADMIN_ID, 'pay_001', 105000);

      expect(mockManager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({ status: PaymentStatus.Refunded }),
      );
      expect(stateMachine.transitionTo).toHaveBeenCalledWith(
        mockManager,
        'booking_001',
        BookingStatus.Refunded,
        ADMIN_ID,
        'admin_manual_refund',
      );
      expect(result).toMatchObject({
        payment_status: PaymentStatus.Refunded,
        fully_refunded: true,
      });
    });
  });

  // ── refunds (list + retry) ────────────────────────────────────

  describe('listRefunds', () => {
    it('filters by status and maps rows with the booking reference', async () => {
      const row = {
        id: 'refund_001',
        paymentId: 'pay_001',
        providerRefundId: null,
        amount: 95000,
        currency: 'USD',
        supplierRefundAmount: 90000,
        status: RefundStatus.Failed,
        reason: 'customer_cancel',
        initiatedByUserId: 'user_001',
        createdAt: new Date(),
        updatedAt: new Date(),
        payment: {
          id: 'pay_001',
          bookingId: 'booking_001',
          booking: { id: 'booking_001', bookingReference: 'ABC123' },
        },
      };
      mockRefundRepo.findAndCount.mockResolvedValue([[row], 1]);

      const result = await service.listRefunds({
        status: RefundStatus.Failed,
        limit: 10,
      });

      expect(mockRefundRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: RefundStatus.Failed },
          take: 10,
        }),
      );
      expect(result.total).toBe(1);
      expect(result.refunds[0]).toMatchObject({
        id: 'refund_001',
        booking_id: 'booking_001',
        booking_reference: 'ABC123',
        status: RefundStatus.Failed,
        amount: 95000,
      });
    });
  });

  describe('retryRefund', () => {
    it('throws 404 when the refund does not exist', async () => {
      mockRefundRepo.findOneBy.mockResolvedValue(null);

      await expect(service.retryRefund(ADMIN_ID, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects retrying a succeeded refund', async () => {
      mockRefundRepo.findOneBy.mockResolvedValue({
        id: 'refund_001',
        status: RefundStatus.Succeeded,
      });

      await expect(service.retryRefund(ADMIN_ID, 'refund_001')).rejects.toThrow(
        ConflictException,
      );
      expect(mockRefundQueue.add).not.toHaveBeenCalled();
    });

    it('resets a failed refund to pending, audits, and re-enqueues it', async () => {
      mockRefundRepo.findOneBy.mockResolvedValue({
        id: 'refund_001',
        status: RefundStatus.Failed,
      });

      const result = await service.retryRefund(ADMIN_ID, 'refund_001');

      expect(mockRefundRepo.update).toHaveBeenCalledWith(
        { id: 'refund_001', status: RefundStatus.Failed },
        { status: RefundStatus.Pending },
      );
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        mockEntityManager,
        ADMIN_ID,
        'refund.retry',
        'refund',
        'refund_001',
        { previous_status: RefundStatus.Failed },
      );
      expect(mockRefundQueue.add).toHaveBeenCalledWith(
        'execute_refund',
        expect.objectContaining({ refundId: 'refund_001' }),
        expect.objectContaining({ jobId: 'refund:refund_001' }),
      );
      expect(result).toEqual({
        id: 'refund_001',
        status: RefundStatus.Pending,
      });
    });
  });

  // ── markup rules ──────────────────────────────────────────────

  describe('markup rules', () => {
    it('creating an active rule deactivates the previous one', async () => {
      const result = await service.createMarkupRule(ADMIN_ID, {
        type: MarkupType.Percentage,
        value: 5,
        is_active: true,
      });

      expect(mockManagerMarkupRepo.update).toHaveBeenCalledWith(
        { isActive: true },
        { isActive: false },
      );
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        mockManager,
        ADMIN_ID,
        'markup_rule.create',
        'markup_rule',
        'generated_id',
        expect.objectContaining({ is_active: true }),
      );
      expect(result).toMatchObject({
        type: MarkupType.Percentage,
        value: 5,
        is_active: true,
      });
    });

    it('creating an inactive rule does not deactivate anything', async () => {
      await service.createMarkupRule(ADMIN_ID, {
        type: MarkupType.Fixed,
        value: 2500,
      });

      expect(mockManagerMarkupRepo.update).not.toHaveBeenCalled();
    });

    it('rejects percentage rules above 100', async () => {
      await expect(
        service.createMarkupRule(ADMIN_ID, {
          type: MarkupType.Percentage,
          value: 150,
          is_active: true,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('activating an existing rule deactivates the current active one', async () => {
      mockManagerMarkupRepo.findOneBy.mockResolvedValue({
        id: 'rule_001',
        type: MarkupType.Percentage,
        value: '3.000',
        isActive: false,
        createdByUserId: ADMIN_ID,
      });

      const result = await service.updateMarkupRule(ADMIN_ID, 'rule_001', {
        is_active: true,
      });

      expect(mockManagerMarkupRepo.update).toHaveBeenCalledWith(
        { isActive: true },
        { isActive: false },
      );
      expect(result).toMatchObject({ id: 'rule_001', is_active: true });
    });

    it('throws 404 when updating a missing rule', async () => {
      mockManagerMarkupRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateMarkupRule(ADMIN_ID, 'missing', { is_active: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── metrics ───────────────────────────────────────────────────

  describe('getMetrics', () => {
    it('aggregates bookings by status, per-currency money, refund and user counts', async () => {
      mockBookingRepo.createQueryBuilder = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'confirmed', count: '7' },
          { status: 'cancelled', count: '2' },
        ]),
      });
      mockBookingRepo.count = jest.fn().mockResolvedValue(1);
      mockPaymentRepo.createQueryBuilder = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ currency: 'USD', charged: '500000' }]),
      });
      mockRefundRepo.createQueryBuilder = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ currency: 'USD', refunded: '95000' }]),
      });
      mockRefundRepo.countBy = jest
        .fn()
        .mockImplementation(({ status }: { status: RefundStatus }) =>
          Promise.resolve(status === RefundStatus.Failed ? 3 : 1),
        );
      mockUserRepo.count.mockResolvedValue(42);
      mockUserRepo.countBy.mockResolvedValue(40);

      const result = await service.getMetrics();

      expect(result).toEqual({
        bookings: {
          total: 9,
          by_status: { confirmed: 7, cancelled: 2 },
          pending_cancellation_requests: 1,
        },
        payments: [
          {
            currency: 'USD',
            charged_amount: 500000,
            refunded_amount: 95000,
            net_amount: 405000,
          },
        ],
        refunds: { pending_count: 1, failed_count: 3 },
        users: { total: 42, active: 40 },
      });
    });
  });

  // ── audit logs ────────────────────────────────────────────────

  describe('listAuditLogs', () => {
    it('applies filters and maps rows with the actor email', async () => {
      const row = {
        id: 'log_001',
        actorUserId: ADMIN_ID,
        actorUser: { email: 'admin@example.com' },
        action: 'booking.cancel',
        entityType: 'booking',
        entityId: 'booking_001',
        metadata: { reason: 'complex fare' },
        createdAt: new Date(),
      };
      mockAuditLogRepo.findAndCount.mockResolvedValue([[row], 1]);

      const result = await service.listAuditLogs({
        entity_type: 'booking',
        entity_id: 'booking_001',
        action: 'booking.cancel',
        actor_user_id: ADMIN_ID,
        limit: 5,
      });

      expect(mockAuditLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entityType: 'booking',
            entityId: 'booking_001',
            action: 'booking.cancel',
            actorUserId: ADMIN_ID,
          },
          take: 5,
        }),
      );
      expect(result.total).toBe(1);
      expect(result.audit_logs[0]).toMatchObject({
        id: 'log_001',
        actor_email: 'admin@example.com',
        action: 'booking.cancel',
        entity_type: 'booking',
        metadata: { reason: 'complex fare' },
      });
    });
  });

  // ── health ────────────────────────────────────────────────────

  describe('getDuffelHealth', () => {
    it('aggregates Duffel metrics, webhook backlog, and stuck-paid count', async () => {
      mockBookingRepo.countBy.mockResolvedValue(3);
      mockWebhookEventRepo.countBy.mockResolvedValue(2);
      mockWebhookEventRepo.findOne.mockResolvedValue({
        receivedAt: new Date(Date.now() - 120_000),
      });

      const result = await service.getDuffelHealth();

      expect(result).toMatchObject({
        duffel: {
          configured: true,
          requests_last_hour: 42,
          errors_last_hour: 2,
        },
        bookings_stuck_in_paid: 3,
      });
      const webhooks = result.webhooks as Record<string, number>;
      expect(webhooks.unprocessed_count).toBe(2);
      expect(webhooks.oldest_unprocessed_age_seconds).toBeGreaterThanOrEqual(
        119,
      );
    });
  });
});
