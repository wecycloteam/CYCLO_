import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  listingId: string;

  // How much of the listing's available quantity the buyer wants — agreedPrice is
  // always derived from this server-side (listing.askingPrice / listing.estimatedWeightKg
  // * quantityKg), never taken from the client directly.
  @IsNumber()
  @IsPositive()
  quantityKg: number;
}
