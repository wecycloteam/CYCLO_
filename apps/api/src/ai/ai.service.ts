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
    let result;
    try {
      result = await this.classifier.classify(dto.imageBase64);
    } catch (error) {
      // Unlike chatGuidance, this call previously had no error handling at all — any
      // classifier failure (bad/missing GEMINI_API_KEY, Gemini API outage, malformed
      // response) surfaced as an opaque, unlogged 500 with nothing to debug from.
      console.error('Waste classifier error:', error);
      throw new InternalServerErrorException('Failed to analyze this image. Please try again.');
    }

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

  // 4. AI Chat Agent Guidance. The system prompt goes in `systemInstruction` (sent once,
  // not replayed as a fake "user" turn on every call — that was doubling prompt size on
  // every message, the main cause of the slow replies) and explicitly bans markdown/emoji
  // and caps length, since the app's plain <div>{text}</div> renderer shows literal "**"
  // characters and the rest of the UI has no emoji anywhere (lucide icons only).
  async chatGuidance(message: string, history: { role: 'user' | 'model'; parts: string }[] = []) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.6-flash',
        config: {
          systemInstruction:
            'You are Cyclo Assistant, an AI recycling and waste management guide for the Cyclo App in Tanzania. ' +
            'You help with sorting waste (Plastic, Cardboard, Textile, Glass, Metal, E-waste), cleaning items ' +
            'before disposal, and estimated local scrap prices in TZS and USD. ' +
            'Reply in plain text only: no markdown (no **bold**, no *, no #, no bullet lists), no emoji. ' +
            'Keep answers short and direct — 2 to 4 sentences unless the user asks for more detail.',
          // gemini-3.6-flash spends part of maxOutputTokens on invisible "thinking" tokens
          // before the visible reply — at 300 that silently ate almost the whole budget and
          // cut real answers off mid-sentence ("Hello! I am Cyclo Assistant, your"). Turning
          // thinking off removes that hidden cost entirely (also the main fix for slow
          // replies) and a higher cap is now a genuine ceiling on the visible text, not a
          // shared pool with reasoning.
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 500,
        },
        contents: [
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

      return { reply: sanitizeAssistantReply(response.text ?? '') };
    } catch (error) {
      console.error('Gemini Chat Error:', error);
      throw new InternalServerErrorException('Failed to generate response from Cyclo AI assistant.');
    }
  }
}

// Safety net in case the model still emits markdown/emoji despite the system instruction
// — strips bold/italic/heading/bullet markers and common emoji ranges without touching
// normal punctuation.
function sanitizeAssistantReply(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/(^|\n)\s*[*-]\s+/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/gu, '')
    .trim();
}