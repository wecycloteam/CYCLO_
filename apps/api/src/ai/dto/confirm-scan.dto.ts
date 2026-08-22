import { IsUUID } from 'class-validator';

export class ConfirmScanDto {
  @IsUUID()
  finalMaterialId: string;
}
