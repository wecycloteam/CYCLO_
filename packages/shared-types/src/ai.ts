// §11-§13 — AI waste classification. The result shape a WasteClassifier implementation
// returns; identical whether the provider behind it is the mock or a real vision model,
// so swapping providers (apps/api/src/ai) never touches API/frontend contracts.
export interface ClassificationResult {
  category: string;
  subtype: string | null;
  label: string;
  confidence: number; // 0-1
  recyclable: boolean;
  handlingInstructions: string[];
  // One-line summary of handlingInstructions for the scan result's headline CTA text,
  // e.g. "Separate and sell to a verified recycler."
  recommendedAction: string;
  // true for every scan today (only MockWasteClassifier is bound) — the UI must show
  // this plainly rather than let a demo classification pass as a real one (§62).
  mock: boolean;
  // Optional, provider-specific enrichment — only GeminiWasteClassifier populates these
  // today. Additive so MockWasteClassifier (and any consumer built before this existed)
  // stays valid without them.
  condition?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  conditionNotes?: string;
  estimatedCapacity?: string | null;
  unitPriceTZS?: number;
  unitPriceUSD?: number;
}
