import { Controller, Get } from '@nestjs/common';
import { PublicStatsService } from './public-stats.service';

// Deliberately outside auth — the landing page (app/page.tsx) that reads this is the
// one page a visitor sees before signing up, so this must work with no token.
@Controller('public-stats')
export class PublicStatsController {
  constructor(private readonly stats: PublicStatsService) {}

  @Get('landing')
  landing() {
    return this.stats.landingStats();
  }
}
