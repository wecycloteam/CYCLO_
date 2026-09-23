import { IsString, Matches, MinLength } from 'class-validator';

const E164 = /^\+[1-9]\d{7,14}$/;

export class LoginDto {
  @Matches(E164, { message: 'phone must be in E.164 format, e.g. +255712345678' })
  phone: string;

  @IsString()
  @MinLength(1)
  password: string;
}
