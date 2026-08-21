import { Module } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';
import { LocationsModule } from '../locations/locations.module';
import { WasteMaterialsModule } from '../waste-materials/waste-materials.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [LocationsModule, WasteMaterialsModule, MarketplaceModule],
  controllers: [CollectionController],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class CollectionModule {}
