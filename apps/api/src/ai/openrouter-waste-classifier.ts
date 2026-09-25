import { Injectable } from '@nestjs/common';
import { ClassificationResult } from '@cyclo/shared-types';
import { WasteClassifier } from './domain/waste-classifier.interface';

// Secondary tier of the hybrid classification strategy (see HybridWasteClassifier) —
// OpenRouter's free tier gives this app a second, independently-quota'd vision model to
// fall back on when Gemini's own daily free quota is exhausted, rather than the scan
// feature going down entirely until the next day's reset.
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

// A free, vision-capable OpenRouter model — kept as a single named constant so swapping
// it (OpenRouter's free-model lineup changes over time) never touches call-site logic.
// OpenRouter tries these in order (its `models` routing) when one is rate-limited upstream.
const OPENROUTER_MODELS = ['google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free', 'qwen/qwen3.8-27b:free'];

const PROMPT = `Analyze this image for waste classification, condition, and market valuation.
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

Return ONLY a valid raw JSON object (no markdown fences, no prose) matching this schema:
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
}`;

@Injectable()
export class OpenRouterWasteClassifier implements WasteClassifier {
  async classify(imageBase64: string): Promise<ClassificationResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

    const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter asks free-tier callers to identify the calling app — not required
        // for the request to work, just good citizenship on a shared free quota.
        'HTTP-Referer': 'https://cycloo.netlify.app',
        'X-Title': 'CYCLO',
      },
      body: JSON.stringify({
        models: OPENROUTER_MODELS,
        temperature: 0.2,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenRouter returned ${response.status}: ${text.slice(0, 300)}`);
    }

    const body = await response.json();
    const raw = body?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== 'string') {
      throw new Error('OpenRouter returned an empty response for this image.');
    }

    const cleanedJson = raw.replace(/```json|```/g, '').trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      throw new Error(`OpenRouter returned malformed JSON for this image: ${cleanedJson.slice(0, 200)}`);
    }

    const category = CATEGORY_MAP[String(parsed.category ?? '').toUpperCase()] ?? 'plastic';
    const recyclable = Boolean(parsed.recyclable);
    const isWaste = parsed.isWaste !== false;

    return {
      isWaste,
      category,
      subtype: parsed.subtype || null,
      label: parsed.label || 'Unidentified Waste Item',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
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
