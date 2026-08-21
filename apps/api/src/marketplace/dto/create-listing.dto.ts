import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PICKUP_OPTIONS } from '@cyclo/shared-types';
import type { PickupOption } from '@cyclo/shared-types';

export class CreateListingDto {
  @IsUUID()
  materialId: string;

  @IsUUID()
  locationId: string;

  @IsNumber()
  @IsPositive()
  estimatedWeightKg: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  grade?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  purity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  askingPrice?: number;

  @IsIn(PICKUP_OPTIONS)
  pickupOption: PickupOption;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
