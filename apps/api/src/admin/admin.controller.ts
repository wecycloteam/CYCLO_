import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { ModerationReasonDto } from './dto/moderation-reason.dto';

// Every route here requires role=admin — see main.ts for why RolesGuard is applied
// locally (after JwtAuthGuard) rather than as a global guard.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('activity')
  activity() {
    return this.admin.recentActivity();
  }

  @Get('users/pending')
  pendingUsers() {
    return this.admin.pendingUsers();
  }

  @Patch('collectors/:userId/verify')
  verifyCollector(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('userId') userId: string,
  ) {
    return this.admin.setCollectorVerification(
      principal.userId,
      userId,
      'verified',
      'COLLECTOR_VERIFIED',
    );
  }

  @Patch('collectors/:userId/reject')
  rejectCollector(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('userId') userId: string,
    @Body() dto: ModerationReasonDto,
  ) {
    return this.admin.setCollectorVerification(
      principal.userId,
      userId,
      'rejected',
      'COLLECTOR_REJECTED',
      dto.reason,
    );
  }

  @Patch('collectors/:userId/suspend')
  suspendCollector(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('userId') userId: string,
    @Body() dto: ModerationReasonDto,
  ) {
    return this.admin.setCollectorVerification(
      principal.userId,
      userId,
      'suspended',
      'COLLECTOR_SUSPENDED',
      dto.reason,
    );
  }

  @Patch('organizations/:orgId/verify')
  verifyOrganization(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('orgId') orgId: string,
  ) {
    return this.admin.setOrganizationVerification(
      principal.userId,
      orgId,
      'verified',
      'ORGANIZATION_VERIFIED',
    );
  }

  @Patch('organizations/:orgId/reject')
  rejectOrganization(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('orgId') orgId: string,
    @Body() dto: ModerationReasonDto,
  ) {
    return this.admin.setOrganizationVerification(
      principal.userId,
      orgId,
      'rejected',
      'ORGANIZATION_REJECTED',
      dto.reason,
    );
  }

  @Patch('organizations/:orgId/suspend')
  suspendOrganization(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('orgId') orgId: string,
    @Body() dto: ModerationReasonDto,
  ) {
    return this.admin.setOrganizationVerification(
      principal.userId,
      orgId,
      'suspended',
      'ORGANIZATION_SUSPENDED',
      dto.reason,
    );
  }

  @Get('listings/pending')
  pendingListings() {
    return this.admin.pendingListings();
  }

  @Patch('listings/:id/approve')
  approveListing(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.admin.approveListing(principal.userId, id);
  }

  @Patch('listings/:id/reject')
  rejectListing(
    @CurrentUser() principal: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ModerationReasonDto,
  ) {
    return this.admin.rejectListing(principal.userId, id, dto.reason);
  }
}
