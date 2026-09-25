import { IsNumber, IsPositive, IsString } from 'class-validator';

export class TopUpDto {
  @IsString()
  provider: string;

  @IsNumber()
  @IsPositive()
  amountTzs: number;
}
