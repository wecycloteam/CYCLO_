import { Matches } from 'class-validator';

// E.164 format, e.g. +255712345678
const E164 = /^\+[1-9]\d{7,14}$/;

export class RequestOtpDto {
  @Matches(E164, { message: 'phone must be in E.164 format, e.g. +255712345678' })
  phone: string;
}
