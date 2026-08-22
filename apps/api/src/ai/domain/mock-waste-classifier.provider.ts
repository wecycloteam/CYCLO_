import { Injectable } from '@nestjs/common';
import { ClassificationResult } from '@cyclo/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { WasteClassifier } from './waste-classifier.interface';

const MIN_CONFIDENCE = 0.55;
const MAX_CONFIDENCE = 0.97;

const GENERIC_HANDLING_INSTRUCTIONS = [
  'Clean the material before listing or collection',
  'Separate it from non-recyclable waste',
  'List it for sale or request a pickup',
];

const NON_RECYCLABLE_HANDLING_INSTRUCTIONS = [
  'Keep separate from recyclable materials',
  'Check with your local authority for safe disposal',
];

const RECOMMENDED_ACTION_RECYCLABLE = 'Separate and sell to a verified recycler.';
const RECOMMENDED_ACTION_NON_RECYCLABLE = 'Not recyclable — dispose of through your local authority.';

// §11-§13 — deliberately does not analyze the image at all: it can't, there's no real
// vision model behind it. It picks a plausible material from the real seeded taxonomy so
// the rest of the flow (confirm/override/list) exercises real data, with a low-ish
// confidence range and `mock: true` so the UI never lets this pass as a genuine result.
@Injectable()
export class MockWasteClassifier implements WasteClassifier {
  constructor(private readonly prisma: PrismaService) {}

  async classify(_imageBase64: string): Promise<ClassificationResult> {
    const materials = await this.prisma.wasteMaterial.findMany({ where: { active: true } });
    if (materials.length === 0) {
      throw new Error('No active waste materials to classify against — run `npm run db:seed`.');
    }
    const material = materials[Math.floor(Math.random() * materials.length)];
    const confidence = MIN_CONFIDENCE + Math.random() * (MAX_CONFIDENCE - MIN_CONFIDENCE);

    return {
      category: material.category,
      subtype: material.subtype,
      label: material.label,
      confidence: Math.round(confidence * 100) / 100,
      recyclable: material.recyclable,
      handlingInstructions: material.recyclable ? GENERIC_HANDLING_INSTRUCTIONS : NON_RECYCLABLE_HANDLING_INSTRUCTIONS,
      recommendedAction: material.recyclable ? RECOMMENDED_ACTION_RECYCLABLE : RECOMMENDED_ACTION_NON_RECYCLABLE,
      mock: true,
    };
  }
}
