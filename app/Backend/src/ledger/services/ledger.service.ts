import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LedgerEntry, LedgerEntryType } from '../entities/ledger-entry.entity';
import { Supplier } from '../../bookings/entities/booking.entity';
import { AuditLogService } from '../../admin/services/audit-log.service';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @InjectRepository(LedgerEntry)
    private readonly ledgerEntryRepo: Repository<LedgerEntry>,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Transaction-aware method to record a ledger entry.
   * Accepts a specific EntityManager to participate in an ongoing transaction.
   */
  async createEntry(
    manager: EntityManager,
    data: {
      entryType: LedgerEntryType;
      amount: number;
      currency: string;
      supplier?: Supplier | null;
      paymentId?: string | null;
      bookingId?: string | null;
      refundId?: string | null;
      note?: string | null;
    },
  ): Promise<LedgerEntry> {
    const entry = new LedgerEntry();
    entry.entryType = data.entryType;
    entry.amount = data.amount;
    // Standardize to uppercase currency
    entry.currency = data.currency.toUpperCase();
    entry.supplier = data.supplier ?? null;
    entry.paymentId = data.paymentId ?? null;
    entry.bookingId = data.bookingId ?? null;
    entry.refundId = data.refundId ?? null;
    entry.note = data.note ?? null;

    const saved = await manager.save(LedgerEntry, entry);
    this.logger.log(
      `Recorded ledger entry [${saved.entryType}] for ${saved.amount} ${saved.currency} (ID: ${saved.id})`,
    );
    return saved;
  }

  /**
   * Returns paginated ledger entries matching option filters, mapped to the
   * snake_case response shape used by the other /admin list endpoints.
   */
  async listEntries(query: {
    limit?: number;
    offset?: number;
    entryType?: LedgerEntryType;
    currency?: string;
    bookingId?: string;
  }): Promise<{
    entries: Record<string, unknown>[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const queryBuilder = this.ledgerEntryRepo
      .createQueryBuilder('le')
      .leftJoinAndSelect('le.booking', 'booking')
      .orderBy('le.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (query.entryType) {
      queryBuilder.andWhere('le.entryType = :entryType', {
        entryType: query.entryType,
      });
    }
    if (query.currency) {
      queryBuilder.andWhere('le.currency = :currency', {
        currency: query.currency.toUpperCase(),
      });
    }
    if (query.bookingId) {
      queryBuilder.andWhere('le.bookingId = :bookingId', {
        bookingId: query.bookingId,
      });
    }

    const [entries, total] = await queryBuilder.getManyAndCount();

    return {
      entries: entries.map((e) => ({
        id: e.id,
        entry_type: e.entryType,
        amount: e.amount,
        currency: e.currency,
        supplier: e.supplier,
        payment_id: e.paymentId,
        booking_id: e.bookingId,
        booking_reference: e.booking?.bookingReference ?? null,
        refund_id: e.refundId,
        note: e.note,
        created_at: e.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Returns cash position and Duffel wallet estimate details grouped by currency.
   */
  async getSummary(): Promise<
    {
      currency: string;
      net_position: number;
      duffel_wallet_estimate: number;
    }[]
  > {
    const results = await this.ledgerEntryRepo
      .createQueryBuilder('le')
      .select('le.currency', 'currency')
      .addSelect('COALESCE(SUM(le.amount), 0)', 'net_position')
      .addSelect(
        "COALESCE(SUM(CASE WHEN le.supplier = 'duffel' THEN le.amount ELSE 0 END), 0)",
        'duffel_wallet_estimate',
      )
      .groupBy('le.currency')
      .getRawMany<{
        currency: string;
        net_position: string;
        duffel_wallet_estimate: string;
      }>();

    return results.map((r) => ({
      currency: (r.currency || '').trim().toUpperCase(),
      net_position: Number(r.net_position),
      duffel_wallet_estimate: Number(r.duffel_wallet_estimate),
    }));
  }

  /**
   * Records a manual reconciliation adjustment entry and writes an AuditLog entry.
   */
  async createAdjustment(
    adminUserId: string,
    dto: {
      amount: number;
      currency: string;
      supplier?: Supplier | null;
      bookingId?: string | null;
      note: string;
    },
  ): Promise<Record<string, unknown>> {
    const entry = await this.entityManager.transaction(async (manager) => {
      const entry = await this.createEntry(manager, {
        entryType: LedgerEntryType.Adjustment,
        amount: dto.amount,
        currency: dto.currency,
        supplier: dto.supplier,
        bookingId: dto.bookingId,
        note: dto.note,
      });

      await this.auditLogService.logAction(
        manager,
        adminUserId,
        'ledger.adjustment',
        'ledger_entry',
        entry.id,
        {
          amount: dto.amount,
          currency: dto.currency,
          supplier: dto.supplier,
          booking_id: dto.bookingId,
          note: dto.note,
        },
      );

      return entry;
    });

    return {
      id: entry.id,
      entry_type: entry.entryType,
      amount: entry.amount,
      currency: entry.currency,
      supplier: entry.supplier,
      payment_id: entry.paymentId,
      booking_id: entry.bookingId,
      refund_id: entry.refundId,
      note: entry.note,
      created_at: entry.createdAt,
    };
  }
}
