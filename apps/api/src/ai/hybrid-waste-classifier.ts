import { Injectable, Logger } from '@nestjs/common';
import { ClassificationResult } from '@cyclo/shared-types';
import { WasteClassifier } from './domain/waste-classifier.interface';
import { GeminiWasteClassifier } from './gemini-waste-classifier';
import { OpenRouterWasteClassifier } from './openrouter-waste-classifier';
import { MockWasteClassifier } from './domain/mock-waste-classifier.provider';

// The tiered/hybrid scan strategy: Gemini is the primary vision model (best accuracy,
// GEMINI_API_KEY's own free-tier quota), OpenRouter's free tier is a second, independently
// quota'd model that only gets called once Gemini has genuinely failed (quota exhausted,
// outage, bad key), and MockWasteClassifier is the final, always-available fallback so a
// user scanning waste is never blocked by two providers being down/exhausted at once —
// they just silently get a lower-confidence, clearly-`mock:true`-flagged result instead of
// an error page. Each tier only tries the next one on a real failure — a definitive "this
// isn't waste" answer from tier 1 is trusted and returned as-is, never re-asked of tier 2.
@Injectable()
export class HybridWasteClassifier implements WasteClassifier {
  private readonly logger = new Logger(HybridWasteClassifier.name);

  constructor(
    private readonly gemini: GeminiWasteClassifier,
    private readonly openRouter: OpenRouterWasteClassifier,
    private readonly mock: MockWasteClassifier,
  ) {}

  async classify(imageBase64: string): Promise<ClassificationResult> {
    try {
      return await this.gemini.classify(imageBase64);
    } catch (geminiError) {
      this.logger.warn(`Gemini classification failed, falling back to OpenRouter: ${describe(geminiError)}`);
    }

    try {
      return await this.openRouter.classify(imageBase64);
    } catch (openRouterError) {
      this.logger.warn(`OpenRouter classification failed, falling back to mock: ${describe(openRouterError)}`);
    }

    return this.mock.classify(imageBase64);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
