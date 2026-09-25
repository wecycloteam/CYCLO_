import { IsString, MinLength } from 'class-validator';

export class PayWithWalletDto {
  @IsString()
  @MinLength(1)
  password: string;
}
