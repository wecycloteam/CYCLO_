import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

// §22 — estimated and verified weight are always distinct fields; this is what sets
// verifiedWeightKg, never estimatedWeightKg.
export class RecordWeightDto {
  @IsNumber()
  @IsPositive()
  verifiedWeightKg: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  method?: string;
}
