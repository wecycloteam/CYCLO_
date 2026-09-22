import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { SELF_REGISTERABLE_ROLES } from '@cyclo/shared-types';
import type { SelfRegisterableRole } from '@cyclo/shared-types';

const E164 = /^\+[1-9]\d{7,14}$/;

export class RegisterDto {
  @IsEmail()
  email: string;

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
