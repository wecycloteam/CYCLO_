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
  TEXTILE: 'textile',
  PAPER: 'paper_cardboard',
  CARDBOARD: 'paper_cardboard',
  PAPER_CARDBOARD: 'paper_cardboard',
  'PAPER & CARDBOARD': 'paper_cardboard',
  METAL: 'metal',
  GLASS: 'glass',
  'E-WASTE': 'e_waste',
  E_WASTE: 'e_waste',
  RUBBER: 'rubber',
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

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function isRetryableGeminiError(error: unknown): boolean {
  // Gemini periodically returns 503 UNAVAILABLE ("This model is currently experiencing
  // high demand... usually temporary") — a real, external capacity issue, not a bug in
  // this app. Retrying a couple of times with a short delay is the honest fix: it doesn't
  // paper over a real failure, it just doesn't give up on the very first transient blip.
  // A malformed/truncated JSON reply is also treated as retryable — that's usually the
  // model getting cut off or emitting stray text around the JSON on a single bad call,
  // not a permanent failure, and retrying fixes it far more often than it repeats.
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('"code":503') ||
    message.includes('UNAVAILABLE') ||
    message.includes('high demand') ||
    message.includes('Gemini returned an empty response') ||
    message.includes('Gemini returned malformed JSON')
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class GeminiWasteClassifier implements WasteClassifier {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  async classify(imageBase64: string): Promise<ClassificationResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.classifyOnce(imageBase64);
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ATTEMPTS && isRetryableGeminiError(error)) {
          console.warn(`Gemini classify attempt ${attempt} failed (retrying):`, error);
          await delay(RETRY_DELAY_MS * attempt);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private async classifyOnce(imageBase64: string): Promise<ClassificationResult> {
    const response = await this.ai.models.generateContent({
      // Same quota reasoning as AiService.chatGuidance — gemini-3.6-flash's 20/day free
      // quota was exhausted and gemini-2.5-flash turned out to be deprecated entirely;
      // gemini-3.5-flash is current and has its own separate, untouched quota bucket.
      model: 'gemini-3.5-flash',
      // Same fix as AiService.chatGuidance: gemini-3.6-flash spends part of its output
      // budget on invisible "thinking" tokens before the visible reply — disabling it
      // keeps this call fast and focused on the actual classification task.
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        // Forces a raw JSON body (no markdown fences, no stray prose around it) instead of
        // relying on prompt wording alone — this is what previously caused occasional
        // "Unexpected token" JSON.parse failures when the model added a sentence before or
        // after the object despite being asked not to.
        responseMimeType: 'application/json',
        // Well above what this schema needs even with a long conditionNotes string — the
        // previous unset default occasionally truncated the JSON mid-object on a verbose
        // reply, which surfaced as a parse error rather than a usable (if imperfect) result.
        maxOutputTokens: 1024,
        // Classification should be consistent, not creative — a lower temperature makes the
        // same photo far less likely to flip category/condition between calls.
        temperature: 0.2,
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze this image for waste classification, condition, and market valuation.
                     CYCLO only deals in these 7 waste categories — you must classify into exactly one of them:
                     PLASTIC (bottles, containers, packaging etc), PAPER_CARDBOARD (boxes, newspapers, office paper etc),
                     METAL (aluminium cans, scrap metal etc), GLASS (bottles and glass containers etc),
                     E-WASTE (old electronics, cables, components etc), TEXTILE (clothes, fabric, offcuts etc),
                     RUBBER (tyres and rubber materials etc).

                     First decide whether the image actually shows a waste or recyclable material at all — not a
                     person, an animal, food being eaten, a random unrelated object/scene, or anything that isn't
                     discarded/recyclable material. If it is NOT a waste/recyclable item, set "isWaste" to false and
                     leave the other classification fields as your best guess (they will be ignored). If it IS a
                     waste item, always pick whichever of the 7 categories above is the closest match — never
                     invent a category outside this list.

                     Currency Rule:
                     - Default currency should be TZS (Tanzanian Shilling) reflecting local scrap market rates.
                     - Provide both TZS and USD equivalent.

                     Return ONLY a valid raw JSON object matching this schema:
                     {
                       "isWaste": boolean (false if the image doesn't show waste/recyclable material at all),
                       "category": "PLASTIC | PAPER_CARDBOARD | METAL | GLASS | E-WASTE | TEXTILE | RUBBER",
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

    // responseMimeType: 'application/json' should mean raw already IS the JSON body, but
    // the fence-stripping stays as a defensive fallback in case a future model revision
    // reintroduces markdown wrapping despite the config.
    const cleanedJson = raw.replace(/```json|```/g, '').trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      throw new Error(`Gemini returned malformed JSON for this image: ${cleanedJson.slice(0, 200)}`);
    }

    const category = CATEGORY_MAP[String(parsed.category ?? '').toUpperCase()] ?? 'plastic';
    const recyclable = Boolean(parsed.recyclable);
    // Defaults true — an older/odd response that omits the field entirely is treated as
    // "yes, this is waste" (the pre-existing behavior) rather than silently rejecting it.
    const isWaste = parsed.isWaste !== false;

    return {
      isWaste,
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
