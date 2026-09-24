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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { MarketplaceService } from './marketplace.service';
import { CreateListingDto } from './dto/create-listing.dto';

@Controller('listings')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() principal: CurrentUserPayload,
    @Body() dto: CreateListingDto,
  ) {
    return this.marketplace.create(principal.userId, principal.role, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  listMine(@CurrentUser() principal: CurrentUserPayload) {
    return this.marketplace.listMine(principal.userId);
  }

  // Public marketplace browse (§ landing/home redesign) — no login required to look,
  // only to act. OptionalJwtAuthGuard still runs the JWT strategy when a token is
  // present so nothing about visibility changes for a logged-in visitor.
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  browse(@Query('cursor') cursor?: string) {
    return this.marketplace.browseActive(cursor);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(
    @CurrentUser() principal: CurrentUserPayload | undefined,
    @Param('id') id: string,
  ) {
    return this.marketplace.findOne(principal?.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/publish')
  publish(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.marketplace.publish(principal.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancel(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.marketplace.cancel(principal.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/contact')
  contact(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.marketplace.contact(principal.userId, id);
  }
}
