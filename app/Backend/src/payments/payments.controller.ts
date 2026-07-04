import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { PaymentsService } from './services/payments.service';

@Controller('bookings')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /bookings/:id/payment-intent
   * Creates or retries a payment attempt for the booking.
   */
  @Post(':id/payment-intent')
  @UseGuards(JwtAuthGuard)
  async createPaymentIntent(
    @CurrentUser() user: User,
    @Param('id') bookingId: string,
  ): Promise<any> {
    return this.paymentsService.createOrGetPaymentAttempt(user, bookingId);
  }

  /**
   * GET /bookings/:id/payment
   * Resolves detailed payment rollup summary for the booking.
   */
  @Get(':id/payment')
  @UseGuards(JwtAuthGuard)
  async getPaymentRollup(
    @CurrentUser() user: User,
    @Param('id') bookingId: string,
  ): Promise<any> {
    return this.paymentsService.getPaymentRollup(user, bookingId);
  }
}
