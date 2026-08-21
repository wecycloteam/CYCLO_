import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WasteMaterialsService } from './waste-materials.service';

@UseGuards(JwtAuthGuard)
@Controller('waste-materials')
export class WasteMaterialsController {
  constructor(private readonly materials: WasteMaterialsService) {}

  @Get()
  listActive() {
    return this.materials.listActive();
  }
}
