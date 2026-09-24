import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { SELF_REGISTERABLE_ROLES } from '@cyclo/shared-types';
import type { SelfRegisterableRole } from '@cyclo/shared-types';
import { normalizeTanzanianPhone } from '../../common/normalize-phone';

const E164 = /^\+[1-9]\d{7,14}$/;
const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;

export class RegisterDto {
  // The identity used to log in (AuthService.login) — chosen here, matched exactly at
  // login. Not the phone number: phone stays contact info for pickup/marketplace.
  @Matches(USERNAME, { message: 'username must be 3-20 characters: letters, numbers, underscore only.' })
  username: string;

  // Optional — email is still useful (Google sign-in links to it) but not required.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password: string;

  // Accepts +255712345678 or the local 0712345678 form — normalized to E.164 before
  // validation, so either input a Tanzanian user would actually type works.
  @Transform(({ value }) => normalizeTanzanianPhone(value))
  @Matches(E164, { message: 'phone must be in E.164 format, e.g. +255712345678 (or start with 0, e.g. 0712345678)' })
  phone: string;

  @IsString()
  @MinLength(2)
  name: string;

  // authority/admin are deliberately excluded — see SELF_REGISTERABLE_ROLES.
  @IsOptional()
  @IsIn(SELF_REGISTERABLE_ROLES)
  role?: SelfRegisterableRole;
}
