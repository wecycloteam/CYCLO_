import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { SELF_REGISTERABLE_ROLES } from '@cyclo/shared-types';
import type { SelfRegisterableRole } from '@cyclo/shared-types';

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

  @Matches(E164, { message: 'phone must be in E.164 format, e.g. +255712345678' })
  phone: string;

  @IsString()
  @MinLength(2)
  name: string;

  // authority/admin are deliberately excluded — see SELF_REGISTERABLE_ROLES.
  @IsOptional()
  @IsIn(SELF_REGISTERABLE_ROLES)
  role?: SelfRegisterableRole;
}
