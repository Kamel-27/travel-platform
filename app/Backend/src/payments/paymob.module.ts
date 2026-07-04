import { Module } from '@nestjs/common';
import { PaymobService } from './services/paymob.service';

/**
 * Standalone module for PaymobService with zero dependency on Bookings or
 * Payments — lets both BookingsModule (customer self-cancel refund) and
 * PaymentsModule import it without a circular module reference.
 */
@Module({
  providers: [PaymobService],
  exports: [PaymobService],
})
export class PaymobModule {}
