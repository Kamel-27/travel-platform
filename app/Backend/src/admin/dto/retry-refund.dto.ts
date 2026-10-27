import { IsBoolean, IsOptional } from 'class-validator';

export class RetryRefundDto {
  /**
   * Required (true) to retry a refund in `executing`: the admin asserts they
   * checked the Paymob dashboard and no refund was issued for it. Ignored for
   * `failed` and stuck `pending` rows.
   */
  @IsOptional()
  @IsBoolean()
  gateway_checked?: boolean;
}
