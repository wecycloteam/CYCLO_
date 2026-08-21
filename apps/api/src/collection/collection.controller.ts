import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CollectionService } from './collection.service';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { RecordWeightDto } from './dto/record-weight.dto';

// Order matters: RolesGuard must run after JwtAuthGuard has populated request.user, and
// same-scope guards execute left-to-right — see main.ts for why this can't be global.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pickup-requests')
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Post()
  create(@CurrentUser() principal: CurrentUserPayload, @Body() dto: CreatePickupRequestDto) {
    return this.collection.create(principal.userId, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() principal: CurrentUserPayload) {
    return this.collection.listMine(principal.userId);
  }

  @Roles('collector')
  @Get('open')
  listOpen() {
    return this.collection.listOpen();
  }

  @Roles('collector')
  @Get('assigned')
  listAssigned(@CurrentUser() principal: CurrentUserPayload) {
    return this.collection.listAssigned(principal.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.collection.findOne(principal.userId, id);
  }

  @Get(':id/events')
  listEvents(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.collection.listEvents(principal.userId, id);
  }

  @Roles('collector')
  @Patch(':id/accept')
  accept(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.collection.accept(principal.userId, id);
  }

  @Roles('collector')
  @Patch(':id/en-route')
  enRoute(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.collection.enRoute(principal.userId, id);
  }

  @Roles('collector')
  @Patch(':id/arrive')
  arrive(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.collection.arrive(principal.userId, id);
  }

  @Roles('collector')
  @Patch(':id/start-collecting')
  startCollecting(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.collection.startCollecting(principal.userId, id);
  }

  @Roles('collector')
  @Patch(':id/weigh')
  recordWeight(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: RecordWeightDto,
  ) {
    return this.collection.recordWeight(principal.userId, id, dto);
  }

  @Roles('collector')
  @Patch(':id/complete')
  complete(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.collection.complete(principal.userId, id);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string) {
    return this.collection.cancel(principal.userId, id);
  }
}
