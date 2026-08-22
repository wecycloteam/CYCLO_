import {
  ArrayMaxSize,
  IsArray,
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
import { PICKUP_OPTIONS, QUANTITY_UNITS } from '@cyclo/shared-types';
import type { PickupOption, QuantityUnit } from '@cyclo/shared-types';

const MAX_PHOTOS = 4;
// Generous cap on one base64 data-URL photo — client-side resizing (apps/web scan/new
// listing pages) keeps real uploads well under this; it exists to reject abuse, not to
// constrain a normal photo.
const MAX_PHOTO_LENGTH = 2_000_000;

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
