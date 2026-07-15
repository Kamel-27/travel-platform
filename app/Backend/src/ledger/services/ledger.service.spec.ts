/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { LedgerService } from './ledger.service';
import { LedgerEntry, LedgerEntryType } from '../entities/ledger-entry.entity';
import { Supplier } from '../../bookings/entities/booking.entity';
import { AuditLogService } from '../../admin/services/audit-log.service';

describe('LedgerService', () => {
  let service: LedgerService;
  let auditLogService: AuditLogService;
  let mockEntityManager: any;
  let mockQueryBuilder: any;
  let mockRepo: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getRawMany: jest.fn(),
    };

    mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockEntityManager = {
      save: jest
        .fn()
        .mockImplementation((_cls: unknown, entity: LedgerEntry) =>
          Promise.resolve(Object.assign(entity, { id: 'le_1' })),
        ),
      transaction: jest.fn().mockImplementation((cb) => cb(mockEntityManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: EntityManager, useValue: mockEntityManager },
        { provide: getRepositoryToken(LedgerEntry), useValue: mockRepo },
        {
          provide: AuditLogService,
          useValue: { logAction: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  describe('createEntry', () => {
    it('saves through the provided manager and uppercases the currency', async () => {
      const entry = await service.createEntry(mockEntityManager, {
        entryType: LedgerEntryType.CustomerPayment,
        amount: 12345,
        currency: 'usd',
        paymentId: 'pay_1',
        bookingId: 'bk_1',
      });

      expect(mockEntityManager.save).toHaveBeenCalledWith(
        LedgerEntry,
        expect.objectContaining({
          entryType: LedgerEntryType.CustomerPayment,
          amount: 12345,
          currency: 'USD',
          paymentId: 'pay_1',
          bookingId: 'bk_1',
          supplier: null,
          refundId: null,
        }),
      );
      expect(entry.id).toBe('le_1');
    });
  });

  describe('listEntries', () => {
    it('maps entities to the snake_case admin response shape', async () => {
      const e = new LedgerEntry();
      e.id = 'le_1';
      e.entryType = LedgerEntryType.SupplierRefund;
      e.amount = 5000;
      e.currency = 'USD';
      e.supplier = Supplier.Duffel;
      e.paymentId = null;
      e.bookingId = 'bk_1';
      e.refundId = 're_1';
      e.note = 'Duffel order cancelled';
      e.createdAt = new Date('2026-07-15T10:00:00Z');
      e.booking = { bookingReference: 'ABC123' } as any;

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[e], 1]);

      const result = await service.listEntries({ limit: 20, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.entries[0]).toEqual({
        id: 'le_1',
        entry_type: 'supplier_refund',
        amount: 5000,
        currency: 'USD',
        supplier: 'duffel',
        payment_id: null,
        booking_id: 'bk_1',
        booking_reference: 'ABC123',
        refund_id: 're_1',
        note: 'Duffel order cancelled',
        created_at: new Date('2026-07-15T10:00:00Z'),
      });
    });

    it('applies entry_type, currency, and booking_id filters', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listEntries({
        entryType: LedgerEntryType.GatewayRefund,
        currency: 'egp',
        bookingId: 'bk_1',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'le.entryType = :entryType',
        { entryType: LedgerEntryType.GatewayRefund },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'le.currency = :currency',
        { currency: 'EGP' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'le.bookingId = :bookingId',
        { bookingId: 'bk_1' },
      );
    });
  });

  describe('getSummary', () => {
    it('converts raw sums to numbers and normalizes currency', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          currency: 'USD',
          net_position: '15000',
          duffel_wallet_estimate: '-4000',
        },
      ]);

      const summary = await service.getSummary();

      expect(summary).toEqual([
        { currency: 'USD', net_position: 15000, duffel_wallet_estimate: -4000 },
      ]);
    });
  });

  describe('createAdjustment', () => {
    it('writes the entry and an audit log row in one transaction', async () => {
      const result = await service.createAdjustment('admin_1', {
        amount: -2500,
        currency: 'USD',
        supplier: Supplier.Duffel,
        bookingId: 'bk_1',
        note: 'Reconciliation vs Duffel dashboard',
      });

      expect(mockEntityManager.transaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        LedgerEntry,
        expect.objectContaining({
          entryType: LedgerEntryType.Adjustment,
          amount: -2500,
          supplier: Supplier.Duffel,
        }),
      );
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        mockEntityManager,
        'admin_1',
        'ledger.adjustment',
        'ledger_entry',
        'le_1',
        expect.objectContaining({
          amount: -2500,
          note: 'Reconciliation vs Duffel dashboard',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'le_1',
          entry_type: 'adjustment',
          amount: -2500,
          currency: 'USD',
        }),
      );
    });
  });
});
