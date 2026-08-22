import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WASTE_CLASSIFIER } from './domain/waste-classifier.interface';
import type { WasteClassifier } from './domain/waste-classifier.interface';
import { ScanImageDto } from './dto/scan-image.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WASTE_CLASSIFIER) private readonly classifier: WasteClassifier,
  ) {}

  async scan(userId: string, dto: ScanImageDto) {
    const result = await this.classifier.classify(dto.imageBase64);

    // §12 — the AI never creates a listing or picks a final material on the user's
    // behalf; finalMaterialId/acceptedResult stay null until confirm() is called.
    const scan = await this.prisma.aiScan.create({
      data: {
        userId,
        category: result.category,
        subtype: result.subtype,
        label: result.label,
        confidence: result.confidence,
        recyclable: result.recyclable,
        mock: result.mock,
      },
    });

    // Best-effort: match the mock's category+subtype back to a real WasteMaterial row
    // so the frontend can preselect it in the listing form without a second lookup.
    const suggestedMaterial = await this.prisma.wasteMaterial.findFirst({
      where: { category: result.category, subtype: result.subtype ?? undefined, active: true },
    });

    return { scanId: scan.id, result, suggestedMaterialId: suggestedMaterial?.id ?? null };
  }

  async confirm(userId: string, scanId: string, finalMaterialId: string) {
    const scan = await this.prisma.aiScan.findUnique({ where: { id: scanId } });
    if (!scan) throw new NotFoundException('Scan not found.');
    if (scan.userId !== userId) throw new ForbiddenException('This scan does not belong to you.');

    const material = await this.prisma.wasteMaterial.findUnique({ where: { id: finalMaterialId } });
    if (!material) throw new NotFoundException('Waste material not found.');

    const acceptedResult = material.category === scan.category && material.subtype === scan.subtype;

    return this.prisma.aiScan.update({
      where: { id: scanId },
      data: { finalMaterialId, acceptedResult },
    });
  }

  history(userId: string) {
    return this.prisma.aiScan.findMany({
      where: { userId },
      include: { finalMaterial: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
