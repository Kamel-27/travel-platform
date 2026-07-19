import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { SupportTicket } from './entities/support-ticket.entity';
import { SupportService } from './services/support.service';
import {
  AdminSupportController,
  SupportController,
} from './support.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportTicket]),
    AuthModule,
    // AuditLogService comes from AdminModule — admin ticket mutations write
    // audit_logs rows like every other admin action.
    AdminModule,
  ],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService],
})
export class SupportModule {}
