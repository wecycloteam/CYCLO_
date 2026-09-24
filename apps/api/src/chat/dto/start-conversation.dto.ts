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
}
