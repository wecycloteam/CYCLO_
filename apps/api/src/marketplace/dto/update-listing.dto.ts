import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PICKUP_OPTIONS, QUANTITY_UNITS } from '@cyclo/shared-types';
import type { PickupOption, QuantityUnit } from '@cyclo/shared-types';

const MAX_PHOTOS = 4;
const MAX_PHOTO_LENGTH = 2_000_000;

// Every field optional — a seller editing a listing (most often in response to an admin's
// "changes requested" advice, see MarketplaceService.update) only sends the fields they
// actually changed, not the whole listing back.
export class UpdateListingDto {
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  estimatedWeightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  condition?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  askingPrice?: number;

  @IsOptional()
  @IsIn(PICKUP_OPTIONS)
  pickupOption?: PickupOption;

  @IsOptional()
  @IsIn(QUANTITY_UNITS)
  quantityUnit?: QuantityUnit;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS)
  @IsString({ each: true })
  @MaxLength(MAX_PHOTO_LENGTH, { each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
