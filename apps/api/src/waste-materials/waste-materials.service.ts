import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WasteMaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  // The taxonomy is admin-managed (master prompt §11 — extensible without a redeploy);
  // Phase 8 adds write endpoints. For now it's seeded via prisma/seed.ts and read-only.
  listActive() {
    return this.prisma.wasteMaterial.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { subtype: 'asc' }],
    });
  }

  async assertExists(materialId: string) {
    const material = await this.prisma.wasteMaterial.findUnique({
      where: { id: materialId },
    });
    if (!material || !material.active) {
      throw new NotFoundException('Waste material not found.');
    }
    return material;
  }
}
