import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RefundPaymentDto {
  /** Refund amount in minor units (e.g. cents). */
  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
