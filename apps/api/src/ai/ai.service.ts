import { Inject, Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';
import { WASTE_CLASSIFIER } from './domain/waste-classifier.interface';
import type { WasteClassifier } from './domain/waste-classifier.interface';
import { ScanImageDto } from './dto/scan-image.dto';

@Injectable()
export class AiService {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WASTE_CLASSIFIER) private readonly classifier: WasteClassifier,
  ) {}

  // 1. Existing Image Scan Logic
  async scan(userId: string, dto: ScanImageDto) {
    const result = await this.classifier.classify(dto.imageBase64);

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

    const suggestedMaterial = await this.prisma.wasteMaterial.findFirst({
      where: { category: result.category, subtype: result.subtype ?? undefined, active: true },
    });

    return { scanId: scan.id, result, suggestedMaterialId: suggestedMaterial?.id ?? null };
  }

  // 2. Existing Scan Confirmation Logic
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

  // 3. Existing Scan History Logic
  history(userId: string) {
    return this.prisma.aiScan.findMany({
      where: { userId },
      include: { finalMaterial: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // 4. NEW: AI Chat Agent Guidance
  async chatGuidance(message: string, history: { role: 'user' | 'model'; parts: string }[] = []) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are Cyclo Assistant, an AI recycling and waste management guide for the Cyclo App in Tanzania.
                       You provide users with helpful guidance on sorting waste (Plastic, Cardboard, Textile, Glass, Metal, E-waste), 
                       cleaning items prior to disposal, and estimated local scrap prices in both TZS (Tanzanian Shilling) and USD.
                       Keep your answers friendly, clear, and concise.`,
              },
            ],
          },
          ...history.map((h) => ({
            role: h.role,
            parts: [{ text: h.parts }],
          })),
          {
            role: 'user',
            parts: [{ text: message }],
          },
        ],
      });

      return { reply: response.text };
    } catch (error) {
      console.error('Gemini Chat Error:', error);
      throw new InternalServerErrorException('Failed to generate response from Cyclo AI assistant.');
    }
  }
}