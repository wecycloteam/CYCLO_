import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  create(@CurrentUser() principal: CurrentUserPayload, @Body() dto: CreateReportDto) {
    return this.reports.create(principal.userId, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() principal: CurrentUserPayload) {
    return this.reports.listMine(principal.userId);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  listAll(@Query('status') status?: string) {
    return this.reports.listAll(status);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(@CurrentUser() principal: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.reports.updateStatus(id, principal.userId, dto);
  }
}
