import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { WASTE_CLASSIFIER } from './domain/waste-classifier.interface';
import { MockWasteClassifier } from './domain/mock-waste-classifier.provider';

/**
 * Binds WASTE_CLASSIFIER to the mock provider for now. Swap the useClass here for a
 * real vision-capable provider once one is selected — nothing outside this module
 * needs to change (same pattern as SmsModule for SMS_PROVIDER).
 */
@Module({
  controllers: [AiController],
  providers: [AiService, { provide: WASTE_CLASSIFIER, useClass: MockWasteClassifier }],
})
export class AiModule {}
