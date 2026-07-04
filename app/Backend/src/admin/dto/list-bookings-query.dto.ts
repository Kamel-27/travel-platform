import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { BookingStatus } from '../../bookings/entities/booking.entity';

export class ListBookingsQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  /** Booking reference (PNR) for customer-support lookups. */
  @IsOptional()
  @IsString()
  reference?: string;

  /** Surfaces non-auto-approvable customer cancellation requests. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  cancellation_requested?: boolean;

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
