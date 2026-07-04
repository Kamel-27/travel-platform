import { IsBoolean } from 'class-validator';

export class UpdateUserDto {
  /** Deactivate (false) or reactivate (true) the account. */
  @IsBoolean()
  is_active: boolean;
}
