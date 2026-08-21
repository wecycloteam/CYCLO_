import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { MarketplaceService } from './marketplace.service';
import { CreateListingDto } from './dto/create-listing.dto';

@UseGuards(JwtAuthGuard)
@Controller('listings')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Post()
  create(
    @CurrentUser() principal: CurrentUserPayload,
    @Body() dto: CreateListingDto,
  ) {
    return this.marketplace.create(principal.userId, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() principal: CurrentUserPayload) {
    return this.marketplace.listMine(principal.userId);
  }

  @Get()
  browse(@Query('cursor') cursor?: string) {
    return this.marketplace.browseActive(cursor);
  }

  @Get(':id')
  findOne(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.marketplace.findOne(principal.userId, id);
  }

  @Patch(':id/publish')
  publish(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.marketplace.publish(principal.userId, id);
  }

  @Patch(':id/cancel')
  cancel(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.marketplace.cancel(principal.userId, id);
  }
}
