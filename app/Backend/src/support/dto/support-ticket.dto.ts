import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  SupportTicketStatus,
  SupportTicketType,
} from '../entities/support-ticket.entity';

export class CreateSupportTicketDto {
  @IsEnum(SupportTicketType)
  type: SupportTicketType;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  booking_reference?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description: string;
}

export class ListSupportTicketsQueryDto {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

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
}

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  admin_note?: string;
}
