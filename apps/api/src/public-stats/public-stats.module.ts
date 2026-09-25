import { Module } from '@nestjs/common';
import { PublicStatsService } from './public-stats.service';
import { PublicStatsController } from './public-stats.controller';

@Module({
  controllers: [PublicStatsController],
  providers: [PublicStatsService],
})
export class PublicStatsModule {}
