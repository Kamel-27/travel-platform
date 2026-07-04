import { IsOptional, IsString } from 'class-validator';

export class CancelBookingSelfDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
