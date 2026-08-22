import { Module } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';
import { LocationsModule } from '../locations/locations.module';
import { WasteMaterialsModule } from '../waste-materials/waste-materials.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [LocationsModule, WasteMaterialsModule, MarketplaceModule, PricingModule],
  controllers: [CollectionController],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class CollectionModule {}
