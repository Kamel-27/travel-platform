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
import { SkipThrottle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { SupportService } from './services/support.service';
import {
  CreateSupportTicketDto,
  ListSupportTicketsQueryDto,
  UpdateSupportTicketDto,
} from './dto/support-ticket.dto';

/** Customer-facing ticket endpoints — any authenticated user. */
@Controller('support/tickets')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /** POST /support/tickets — open a new support ticket. */
  @Post()
  createTicket(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.supportService.createTicket(user.sub, dto);
  }

  /** GET /support/tickets — the caller's own tickets, newest first. */
  @Get()
  listMyTickets(@CurrentUser() user: JwtPayload) {
    return this.supportService.listMyTickets(user.sub);
  }
}

/**
 * Support queue management — technical_admin only, mutations audited
 * (same policy as AdminController: exempt from throttling but logged).
 */
@Controller('admin/support/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TechnicalAdmin)
@SkipThrottle()
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  /** GET /admin/support/tickets?status=&limit=&offset= */
  @Get()
  listTickets(@Query() query: ListSupportTicketsQueryDto) {
    return this.supportService.listTickets(query);
  }

  /** PATCH /admin/support/tickets/:id — update status / reply note. */
  @Patch(':id')
  updateTicket(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.supportService.updateTicket(admin.sub, ticketId, dto);
  }
}
