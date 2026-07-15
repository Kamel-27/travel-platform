import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';

import { LedgerService } from './services/ledger.service';
import { LedgerEntryType } from './entities/ledger-entry.entity';
import { Supplier } from '../bookings/entities/booking.entity';

export class CreateAdjustmentDto {
  @IsInt()
  amount: number;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsOptional()
  @IsEnum(Supplier)
  supplier?: Supplier;

  @IsOptional()
  @IsUUID()
  booking_id?: string;

  @IsString()
  @MaxLength(500)
  note: string;
}

export class ListLedgerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsEnum(LedgerEntryType)
  entry_type?: LedgerEntryType;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUUID()
  booking_id?: string;
}

@Controller('admin/ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TechnicalAdmin)
@SkipThrottle()
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  async listEntries(@Query() query: ListLedgerQueryDto) {
    return this.ledgerService.listEntries({
      limit: query.limit,
      offset: query.offset,
      entryType: query.entry_type,
      currency: query.currency,
      bookingId: query.booking_id,
    });
  }

  @Get('summary')
  async getSummary() {
    return this.ledgerService.getSummary();
  }

  @Post('adjustment')
  async createAdjustment(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreateAdjustmentDto,
  ) {
    return this.ledgerService.createAdjustment(admin.sub, {
      amount: dto.amount,
      currency: dto.currency,
      supplier: dto.supplier,
      bookingId: dto.booking_id,
      note: dto.note,
    });
  }
}
