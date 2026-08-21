import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';

@UseGuards(JwtAuthGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  create(
    @CurrentUser() principal: CurrentUserPayload,
    @Body() dto: CreateLocationDto,
  ) {
    return this.locations.create(principal.userId, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() principal: CurrentUserPayload) {
    return this.locations.listMine(principal.userId);
  }
}
