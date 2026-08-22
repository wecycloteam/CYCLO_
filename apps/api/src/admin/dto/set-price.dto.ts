import { IsNumber, Min } from 'class-validator';

export class SetPriceDto {
  @IsNumber()
  @Min(0)
  pricePerKg: number;
}
