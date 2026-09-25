import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { LocationsModule } from '../locations/locations.module';
import { WasteMaterialsModule } from '../waste-materials/waste-materials.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [LocationsModule, WasteMaterialsModule, NotificationsModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
