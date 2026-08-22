import { ClassificationResult } from '@cyclo/shared-types';

export const WASTE_CLASSIFIER = Symbol('WASTE_CLASSIFIER');

// §11 — swappable behind this interface. Only MockWasteClassifier is bound today
// (see ai.module.ts); a real vision-capable provider implements this same interface
// and nothing outside ai.module.ts needs to change to swap it in.
export interface WasteClassifier {
  classify(imageBase64: string): Promise<ClassificationResult>;
}
