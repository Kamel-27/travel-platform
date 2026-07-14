import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListAuditLogsQueryDto {
  /** e.g. `booking`, `payment`, `refund`, `user`, `markup_rule` */
  @IsOptional()
  @IsString()
  entity_type?: string;

  /** Narrow to one entity's full history (pairs with entity_type). */
  @IsOptional()
  @IsString()
  entity_id?: string;

  /** e.g. `booking.cancel`, `payment.refund`, `refund.retry` */
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsUUID()
  actor_user_id?: string;

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
