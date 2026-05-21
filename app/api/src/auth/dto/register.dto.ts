import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterCompanyDto {
  // ── Company details ──
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  companyNameAr?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  licenseNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'Phone must be a valid international format',
  })
  companyPhone: string;

  @IsEmail()
  @IsNotEmpty()
  companyEmail: string;

  @IsString()
  @IsOptional()
  website?: string;

  // ── Admin user details ──
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  adminPassword: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  adminFullName: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  adminFullNameAr?: string;

  @IsString()
  @IsOptional()
  adminPhone?: string;
}
