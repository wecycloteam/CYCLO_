import { IsOptional, IsUUID } from 'class-validator';

export class StartConversationDto {
  // Either identifies a specific seller directly, or is derived server-side from
  // listingId — one of the two must resolve to a seller, enforced in ChatService.
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;

  // Only honoured when the caller is the listing's own seller (e.g. messaging the buyer
  // from an order) — lets the seller open the same buyer/seller thread from their side.
  @IsOptional()
  @IsUUID()
  buyerId?: string;
}
