import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// §18/§19 — a pickup request either references one of the producer's own ACTIVE listings
// (the §75 vertical-slice path: list -> request pickup) or stands alone with its own
// material/weight (the general "just pick this up" case §18 also describes). Exactly one
// of the two shapes must be provided — not both, not neither.
export class CreatePickupRequestDto {
  @IsUUID()
  locationId: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;

  @ValidateIf((dto: CreatePickupRequestDto) => !dto.listingId)
  @IsUUID()
  materialId?: string;

  @ValidateIf((dto: CreatePickupRequestDto) => !dto.listingId)
  @IsNumber()
  @IsPositive()
  estimatedWeightKg?: number;

  @IsOptional()
  @IsDateString()
  preferredTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
