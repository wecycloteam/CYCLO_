import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerationReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
