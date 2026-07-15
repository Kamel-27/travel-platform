import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { LedgerService } from './services/ledger.service';
import { LedgerController } from './ledger.controller';
import { AuditLogService } from '../admin/services/audit-log.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntry]), AuthModule],
  controllers: [LedgerController],
  providers: [LedgerService, AuditLogService],
  exports: [LedgerService, TypeOrmModule],
})
export class LedgerModule {}
