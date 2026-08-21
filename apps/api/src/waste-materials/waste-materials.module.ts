import { Module } from '@nestjs/common';
import { WasteMaterialsService } from './waste-materials.service';
import { WasteMaterialsController } from './waste-materials.controller';

@Module({
  controllers: [WasteMaterialsController],
  providers: [WasteMaterialsService],
  exports: [WasteMaterialsService],
})
export class WasteMaterialsModule {}
