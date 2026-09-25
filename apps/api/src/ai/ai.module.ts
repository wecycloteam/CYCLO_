import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { WASTE_CLASSIFIER } from './domain/waste-classifier.interface';
import { GeminiWasteClassifier } from './gemini-waste-classifier';
import { OpenRouterWasteClassifier } from './openrouter-waste-classifier';
import { HybridWasteClassifier } from './hybrid-waste-classifier';
import { MockWasteClassifier } from './domain/mock-waste-classifier.provider';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    GeminiWasteClassifier,
    OpenRouterWasteClassifier,
    MockWasteClassifier,
    HybridWasteClassifier,
    { provide: WASTE_CLASSIFIER, useClass: HybridWasteClassifier },
  ],
})
export class AiModule {}