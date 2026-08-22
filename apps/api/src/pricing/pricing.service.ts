import { Injectable } from '@nestjs/common';
import { WASTE_CATEGORIES } from '@cyclo/shared-types';
import type { WasteCategory } from '@cyclo/shared-types';
import { PrismaService } from '../prisma/prisma.service';

// §17 — the transparent-pricing engine. One admin-editable price per WasteMaterial
// category; every "Estimated Market Value" shown anywhere (scan result, listing form,
// listing card) reads from here, never a hardcoded number.
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.wastePrice.findMany({ orderBy: { category: 'asc' } });
  }

  // A category with no admin-set price yet is a real, distinct state — callers must
  // treat a missing entry as "no estimate available", not silently default to zero.
  async asMap(): Promise<Partial<Record<WasteCategory, number>>> {
    const rows = await this.list();
    const map: Partial<Record<WasteCategory, number>> = {};
    for (const row of rows) map[row.category as WasteCategory] = row.pricePerKg;
    return map;
  }

  async priceFor(category: string): Promise<number | null> {
    const row = await this.prisma.wastePrice.findUnique({ where: { category } });
    return row?.pricePerKg ?? null;
  }

  upsert(category: WasteCategory, pricePerKg: number) {
    return this.prisma.wastePrice.upsert({
      where: { category },
      update: { pricePerKg },
      create: { category, pricePerKg },
    });
  }

  static readonly CATEGORIES = WASTE_CATEGORIES;
}
