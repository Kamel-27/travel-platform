import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { MagicLinkToken } from '../entities/magic-link-token.entity';

const RETENTION_MS = 24 * 60 * 60 * 1000; // nfr.md §8: purge 24h after expiry

/** Purges expired MagicLinkToken rows (nfr.md §8 retention policy). */
@Injectable()
export class MagicLinkTokenPurgeService {
  private readonly logger = new Logger(MagicLinkTokenPurgeService.name);

  constructor(
    @InjectRepository(MagicLinkToken)
    private readonly tokenRepo: Repository<MagicLinkToken>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const result = await this.tokenRepo.delete({ expiresAt: LessThan(cutoff) });
    if (result.affected) {
      this.logger.log(`Purged ${result.affected} expired magic-link token(s).`);
    }
  }
}
