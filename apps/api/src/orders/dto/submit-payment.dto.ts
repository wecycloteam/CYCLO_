import { IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitPaymentDto {
  // The confirmation code/reference text from the buyer's mobile money provider
  // (e.g. an M-Pesa/Tigo Pesa/Airtel Money transaction ID) — entered by hand since no
  // payment gateway is wired up to verify it automatically.
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  reference: string;
}
