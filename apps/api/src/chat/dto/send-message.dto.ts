import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  // Optional now — an attachment-only message has no typed caption. Validated in
  // ChatService.sendMessage that at least one of body/attachmentUrl is present.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsIn(['image', 'audio'])
  attachmentType?: 'image' | 'audio';
}
