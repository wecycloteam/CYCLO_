import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { WASTE_CLASSIFIER } from './domain/waste-classifier.interface';
import { GeminiWasteClassifier } from './gemini-waste-classifier';

@Module({
  controllers: [AiController],
  providers: [
    AiService, 
    { provide: WASTE_CLASSIFIER, useClass: GeminiWasteClassifier },
  ],
})
export class AiModule {}