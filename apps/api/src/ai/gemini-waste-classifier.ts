import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { ClassificationResult } from '@cyclo/shared-types';
import { WasteClassifier } from './domain/waste-classifier.interface';

// Gemini is prompted with human-readable category names; the app's real WasteMaterial
// taxonomy (see prisma/seed.ts) uses these lowercase snake_case values. Without this
// mapping, `category` would never match a real WasteMaterial row — breaking both the
// scan result's suggested-material preselect (AiService.scan) and the reference-price
// lookup on the scan page (which matches on WastePrice.category).
const CATEGORY_MAP: Record<string, string> = {
  PLASTIC: 'plastic',
  TEXTILE: 'other',
  PAPER: 'paper',
  CARDBOARD: 'cardboard',
  METAL: 'metal',
  GLASS: 'glass',
  ORGANIC: 'organic',
  'E-WASTE': 'e_waste',
  E_WASTE: 'e_waste',
  OTHER: 'other',
};

const HANDLING_INSTRUCTIONS_RECYCLABLE = [
  'Clean the material before listing or collection',
  'Separate it from non-recyclable waste',
  'List it for sale or request a pickup',
];

const HANDLING_INSTRUCTIONS_NON_RECYCLABLE = [
  'Keep separate from recyclable materials',
  'Check with your local authority for safe disposal',
];

@Injectable()
export class GeminiWasteClassifier implements WasteClassifier {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  async classify(imageBase64: string): Promise<ClassificationResult> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze this image for waste classification, condition, and market valuation.
                     Categories: PLASTIC, TEXTILE, PAPER, CARDBOARD, METAL, GLASS, ORGANIC, E-WASTE, or OTHER.

                     Currency Rule:
                     - Default currency should be TZS (Tanzanian Shilling) reflecting local scrap market rates.
                     - Provide both TZS and USD equivalent.

                     Return ONLY a valid raw JSON object matching this schema:
                     {
                       "category": "PLASTIC | TEXTILE | PAPER | CARDBOARD | METAL | GLASS | ORGANIC | E-WASTE | OTHER",
                       "subtype": "string or null",
                       "label": "descriptive name",
                       "confidence": number between 0 and 1,
                       "recyclable": boolean,
                       "condition": "EXCELLENT | GOOD | FAIR | POOR",
                       "conditionNotes": "short notes on material cleanliness/state",
                       "estimatedCapacity": "string or null (e.g. '500ml', '1.5L')",
                       "pricingUnit": "PER_PIECE | PER_KG | PER_GRAM",
                       "unitPriceTZS": number (estimated rate in TZS),
                       "unitPriceUSD": number (estimated rate in USD),
                       "currency": "TZS"
                     }`,
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
              },
            },
          ],
        },
      ],
    });

    const raw = response.text;
    if (!raw) {
      throw new Error('Gemini returned an empty response for this image.');
    }

    const cleanedJson = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    const category = CATEGORY_MAP[String(parsed.category ?? '').toUpperCase()] ?? 'other';
    const recyclable = Boolean(parsed.recyclable);

    return {
      category,
      subtype: parsed.subtype || null,
      label: parsed.label || 'Unidentified Waste Item',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      recyclable,
      handlingInstructions: recyclable ? HANDLING_INSTRUCTIONS_RECYCLABLE : HANDLING_INSTRUCTIONS_NON_RECYCLABLE,
      recommendedAction: recyclable
        ? 'Separate and sell to a verified recycler.'
        : 'Not recyclable — dispose of through your local authority.',
      mock: false,
      condition: parsed.condition || 'FAIR',
      conditionNotes: parsed.conditionNotes || '',
      estimatedCapacity: parsed.estimatedCapacity || null,
      unitPriceTZS: typeof parsed.unitPriceTZS === 'number' ? parsed.unitPriceTZS : 0,
      unitPriceUSD: typeof parsed.unitPriceUSD === 'number' ? parsed.unitPriceUSD : 0,
    };
  }
}
