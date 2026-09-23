import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ImpactService } from './impact.service';

@UseGuards(JwtAuthGuard)
@Controller('impact')
export class ImpactController {
  constructor(private readonly impact: ImpactService) {}

  @Get('me')
  getMine(@CurrentUser() principal: CurrentUserPayload) {
    return this.impact.getUserImpact(principal.userId);
  }
}
