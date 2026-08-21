import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Phase 2 only issues locations owned by the current user (household/business self-service).
// Organization-owned locations (§31 multi-location businesses) extend this later without
// changing the shape here.
export class CreateLocationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  addressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @IsOptional()
  @IsIn(['TZ', 'KE', 'UG', 'RW'])
  country?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
