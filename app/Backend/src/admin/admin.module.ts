import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsModule } from '../payments/payments.module';
import { DuffelModule } from '../duffel/duffel.module';

import { User } from '../users/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { MarkupRule } from '../bookings/entities/markup-rule.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PaymentWebhookEvent } from '../payments/entities/payment-webhook-event.entity';
import { AuditLog } from './entities/audit-log.entity';

import { AdminController } from './admin.controller';
import { AdminService } from './services/admin.service';
import { AuditLogService } from './services/audit-log.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      Booking,
      MarkupRule,
      Payment,
      PaymentWebhookEvent,
      AuditLog,
    ]),
    AuthModule,
    BookingsModule,
    PaymentsModule,
    DuffelModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AuditLogService],
  exports: [AuditLogService],
})
export class AdminModule {}
