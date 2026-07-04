import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CabinClass {
  Economy = 'economy',
  PremiumEconomy = 'premium_economy',
  Business = 'business',
  First = 'first',
}

export class FlightSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Origin must be a 3-letter IATA airport code in uppercase.',
  })
  origin: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Destination must be a 3-letter IATA airport code in uppercase.',
  })
  destination: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Departure date must be in YYYY-MM-DD format.',
  })
  departure_date: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Return date must be in YYYY-MM-DD format.',
  })
  return_date?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  children = 0;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  infants = 0;

  @IsEnum(CabinClass)
  @IsOptional()
  cabin_class?: CabinClass;
}
