import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Get wallet balance for a company
   */
  async getBalance(companyId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { companyId },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found for this company');
    }

    return {
      balance: wallet.balance,
      currency: wallet.currency,
      isActive: wallet.isActive,
    };
  }

  /**
   * Get wallet transaction history
   */
  async getTransactions(
    companyId: string,
    page = 1,
    limit = 20,
    type?: string,
  ) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { companyId },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    const where: any = { walletId: wallet.id };
    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          booking: {
            select: { id: true, type: true, pnr: true, status: true },
          },
        },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Process a deposit (called by admin after approving deposit request)
   */
  async processDeposit(
    companyId: string,
    amount: number,
    reference: string,
    idempotencyKey: string,
    approvedBy: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Deposit amount must be positive');
    }

    // Check idempotency
    const existing = await this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      throw new ConflictException('This transaction has already been processed');
    }

    const bonusPercentage = parseFloat(
      this.config.get<string>('DEPOSIT_BONUS_PERCENTAGE') || '10',
    );
    const bonusAmount = (amount * bonusPercentage) / 100;
    const totalCredit = amount + bonusAmount;

    const result = await this.prisma.$transaction(async (tx) => {
      // Lock wallet row
      const wallet = await tx.wallet.findUnique({
        where: { companyId },
      });

      if (!wallet || !wallet.isActive) {
        throw new BadRequestException('Wallet is not active');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = new Prisma.Decimal(balanceBefore.toString())
        .add(new Prisma.Decimal(totalCredit.toString()));

      // Create deposit transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount: new Prisma.Decimal(amount.toString()),
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          reference,
          description: `Deposit of ${amount} ${wallet.currency}`,
          idempotencyKey,
        },
      });

      // Create bonus credit transaction if applicable
      if (bonusAmount > 0) {
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'BONUS_CREDIT',
            amount: new Prisma.Decimal(bonusAmount.toString()),
            balanceBefore: new Prisma.Decimal(balanceBefore.toString())
              .add(new Prisma.Decimal(amount.toString())),
            balanceAfter,
            currency: wallet.currency,
            reference,
            description: `${bonusPercentage}% bonus on deposit of ${amount} ${wallet.currency}`,
            idempotencyKey: `${idempotencyKey}_bonus`,
          },
        });
      }

      // Update wallet balance with optimistic locking
      const updated = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          version: wallet.version,
        },
        data: {
          balance: balanceAfter,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          'Wallet was modified concurrently. Please retry.',
        );
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: approvedBy,
          action: 'DEPOSIT_APPROVED',
          entity: 'Wallet',
          entityId: wallet.id,
          changes: {
            amount,
            bonusAmount,
            totalCredit,
            balanceBefore: balanceBefore.toString(),
            balanceAfter: balanceAfter.toString(),
          },
        },
      });

      return {
        deposit: amount,
        bonus: bonusAmount,
        totalCredited: totalCredit,
        balanceAfter,
        currency: wallet.currency,
      };
    });

    this.logger.log(
      `Deposit processed for company ${companyId}: ${amount} + ${bonusAmount} bonus`,
    );

    return result;
  }

  /**
   * Debit wallet for a booking (called internally by booking service)
   */
  async debitForBooking(
    companyId: string,
    bookingId: string,
    amount: number,
    currency: string,
    idempotencyKey: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Debit amount must be positive');
    }

    // Check idempotency
    const existing = await this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { alreadyProcessed: true };
    }

    return await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { companyId },
      });

      if (!wallet || !wallet.isActive) {
        throw new BadRequestException('Wallet is not active');
      }

      const balanceBefore = wallet.balance;
      const debitAmount = new Prisma.Decimal(amount.toString());

      if (balanceBefore.lessThan(debitAmount)) {
        throw new BadRequestException(
          `Insufficient balance. Available: ${balanceBefore} ${wallet.currency}, Required: ${amount} ${currency}`,
        );
      }

      const balanceAfter = new Prisma.Decimal(balanceBefore.toString())
        .sub(debitAmount);

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          bookingId,
          type: 'BOOKING_DEBIT',
          amount: debitAmount,
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          description: `Booking payment for #${bookingId}`,
          idempotencyKey,
        },
      });

      const updated = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          version: wallet.version,
        },
        data: {
          balance: balanceAfter,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          'Wallet was modified concurrently. Please retry.',
        );
      }

      return {
        success: true,
        balanceAfter,
        currency: wallet.currency,
      };
    });
  }

  /**
   * Refund to wallet (called on booking cancellation)
   */
  async refundToWallet(
    companyId: string,
    bookingId: string,
    amount: number,
    idempotencyKey: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Refund amount must be positive');
    }

    const existing = await this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { alreadyProcessed: true };
    }

    return await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { companyId },
      });

      if (!wallet) {
        throw new BadRequestException('Wallet not found');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = new Prisma.Decimal(balanceBefore.toString())
        .add(new Prisma.Decimal(amount.toString()));

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          bookingId,
          type: 'REFUND_CREDIT',
          amount: new Prisma.Decimal(amount.toString()),
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          description: `Refund for booking #${bookingId}`,
          idempotencyKey,
        },
      });

      await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          version: wallet.version,
        },
        data: {
          balance: balanceAfter,
          version: { increment: 1 },
        },
      });

      return {
        success: true,
        refundAmount: amount,
        balanceAfter,
        currency: wallet.currency,
      };
    });
  }
}
