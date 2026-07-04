import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PassengerGender,
  PassengerTitle,
  PassengerType,
} from '../entities/passenger.entity';

export class PassengerDocumentDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'document expiry must be in YYYY-MM-DD format',
  })
  expiry: string;

  @IsString()
  @Length(2, 2, {
    message: 'nationality must be a 2-character ISO country code',
  })
  @IsNotEmpty()
  nationality: string;
}

export class PassengerInputDto {
  @IsEnum(PassengerType)
  type: PassengerType;

  @IsEnum(PassengerTitle)
  title: PassengerTitle;

  @IsEnum(PassengerGender)
  gender: PassengerGender;

  @IsString()
  @IsNotEmpty()
  given_name: string;

  @IsString()
  @IsNotEmpty()
  family_name: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date_of_birth must be in YYYY-MM-DD format',
  })
  date_of_birth: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  responsible_adult_index?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PassengerDocumentDto)
  document?: PassengerDocumentDto;
}

export class SavePassengersDto {
  @ValidateNested({ each: true })
  @Type(() => PassengerInputDto)
  passengers: PassengerInputDto[];
}
