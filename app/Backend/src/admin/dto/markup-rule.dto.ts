import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { MarkupType } from '../../bookings/entities/markup-rule.entity';

export class CreateMarkupRuleDto {
  @IsEnum(MarkupType)
  type: MarkupType;

  /** Percentage value (e.g. 5 = 5%) or fixed amount in minor units. */
  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateMarkupRuleDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
