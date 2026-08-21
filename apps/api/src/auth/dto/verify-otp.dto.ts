import { IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { SELF_REGISTERABLE_ROLES } from '@cyclo/shared-types';
import type { SelfRegisterableRole } from '@cyclo/shared-types';

const E164 = /^\+[1-9]\d{7,14}$/;

export class VerifyOtpDto {
  @Matches(E164, { message: 'phone must be in E.164 format, e.g. +255712345678' })
  phone: string;

  @IsString()
  @Length(6, 6)
  code: string;

  // Only used the first time a phone number completes verification (account creation).
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  // authority/admin are deliberately excluded — see SELF_REGISTERABLE_ROLES.
  @IsOptional()
  @IsIn(SELF_REGISTERABLE_ROLES)
  role?: SelfRegisterableRole;
}
