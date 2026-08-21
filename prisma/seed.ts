// Seeds the canonical waste-material taxonomy (master prompt §11, §14).
// Idempotent — safe to re-run after editing the list below; upserts by the
// (category, subtype) unique constraint instead of wiping the table, so listings
// that already reference a material row are never orphaned by a re-seed.
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

const MATERIALS: Array<{
  category: string;
  subtype: string;
  label: string;
  recyclable: boolean;
}> = [
  { category: 'plastic', subtype: 'PET', label: 'PET Plastic (bottles)', recyclable: true },
  { category: 'plastic', subtype: 'HDPE', label: 'HDPE Plastic (containers)', recyclable: true },
  { category: 'plastic', subtype: 'PVC', label: 'PVC Plastic', recyclable: false },
  { category: 'plastic', subtype: 'LDPE', label: 'LDPE Plastic (bags/film)', recyclable: true },
  { category: 'plastic', subtype: 'PP', label: 'Polypropylene', recyclable: true },
  { category: 'plastic', subtype: 'OTHER', label: 'Other Plastic', recyclable: false },
  { category: 'paper', subtype: 'OFFICE', label: 'Office/Printer Paper', recyclable: true },
  { category: 'paper', subtype: 'NEWSPAPER', label: 'Newspaper', recyclable: true },
  { category: 'cardboard', subtype: 'CORRUGATED', label: 'Corrugated Cardboard', recyclable: true },
  { category: 'glass', subtype: 'CLEAR', label: 'Clear Glass', recyclable: true },
  { category: 'glass', subtype: 'COLORED', label: 'Colored Glass', recyclable: true },
  { category: 'metal', subtype: 'ALUMINUM', label: 'Aluminum (cans)', recyclable: true },
  { category: 'metal', subtype: 'STEEL', label: 'Steel/Tin', recyclable: true },
  { category: 'metal', subtype: 'COPPER', label: 'Copper', recyclable: true },
  { category: 'e_waste', subtype: 'ELECTRONICS', label: 'Electronics (general)', recyclable: true },
  { category: 'e_waste', subtype: 'BATTERIES', label: 'Batteries', recyclable: true },
  { category: 'organic', subtype: 'FOOD_WASTE', label: 'Food Waste', recyclable: true },
  { category: 'organic', subtype: 'GARDEN_WASTE', label: 'Garden Waste', recyclable: true },
  { category: 'other', subtype: 'MIXED', label: 'Mixed/Unsorted', recyclable: false },
];

async function main() {
  for (const material of MATERIALS) {
    await prisma.wasteMaterial.upsert({
      where: { category_subtype: { category: material.category, subtype: material.subtype } },
      update: { label: material.label, recyclable: material.recyclable },
      create: material,
    });
  }
  console.log(`Seeded ${MATERIALS.length} waste materials.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
