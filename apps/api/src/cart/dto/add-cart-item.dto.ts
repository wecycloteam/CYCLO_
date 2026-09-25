import { IsNumber, IsPositive, IsString } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  listingId: string;

  @IsNumber()
  @IsPositive()
  quantityKg: number;
}
