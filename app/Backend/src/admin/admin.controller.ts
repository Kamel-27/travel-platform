import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { AdminService } from './services/admin.service';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import {
  CreateMarkupRuleDto,
  UpdateMarkupRuleDto,
} from './dto/markup-rule.dto';

/**
 * Management surface per api_contract.md §7 — every endpoint requires the
 * technical_admin role, and every mutation writes an AuditLog row (enforced
 * in AdminService, not per endpoint).
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TechnicalAdmin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /admin/users?email=&role=&is_active= */
  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  /** PATCH /admin/users/:id — activate/deactivate an account. */
  @Patch('users/:id')
  updateUser(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(admin.sub, userId, dto.is_active);
  }

  /** GET /admin/bookings?status=&user_id=&reference= */
  @Get('bookings')
  listBookings(@Query() query: ListBookingsQueryDto) {
    return this.adminService.listBookings(query);
  }

  /** POST /admin/bookings/:id/cancel — T7 for non-auto-approvable cases. */
  @Post('bookings/:id/cancel')
  cancelBooking(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.adminService.cancelBooking(admin.sub, bookingId, dto.reason);
  }

  /** POST /admin/payments/:id/refund — manual gateway refund. */
  @Post('payments/:id/refund')
  refundPayment(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) paymentId: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.adminService.refundPayment(
      admin.sub,
      paymentId,
      dto.amount,
      dto.reason,
    );
  }

  /** GET /admin/markup-rules */
  @Get('markup-rules')
  listMarkupRules() {
    return this.adminService.listMarkupRules();
  }

  /** POST /admin/markup-rules — activating one deactivates the previous. */
  @Post('markup-rules')
  createMarkupRule(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreateMarkupRuleDto,
  ) {
    return this.adminService.createMarkupRule(admin.sub, dto);
  }

  /** PATCH /admin/markup-rules/:id */
  @Patch('markup-rules/:id')
  updateMarkupRule(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateMarkupRuleDto,
  ) {
    return this.adminService.updateMarkupRule(admin.sub, ruleId, dto);
  }

  /** GET /admin/health/duffel — operational dashboard details. */
  @Get('health/duffel')
  getDuffelHealth() {
    return this.adminService.getDuffelHealth();
  }
}
