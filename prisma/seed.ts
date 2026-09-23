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

// §17 — reference prices (TZS/kg) shown as "Estimated Market Value" everywhere and
// editable from the admin dashboard. Approximate real-world East Africa scrap-value
// ordering (metal/e-waste highest, organic/mixed lowest) — a starting point, not a claim
// of accuracy; admins are expected to correct these to real market rates.
const PRICES: Array<{ category: string; pricePerKg: number }> = [
  { category: 'plastic', pricePerKg: 500 },
  { category: 'paper', pricePerKg: 200 },
  { category: 'cardboard', pricePerKg: 150 },
  { category: 'glass', pricePerKg: 100 },
  { category: 'metal', pricePerKg: 1200 },
  { category: 'e_waste', pricePerKg: 2000 },
  { category: 'organic', pricePerKg: 50 },
  { category: 'other', pricePerKg: 100 },
];

// §14 — DEMO DATA so the marketplace is never empty for a live demo. Tagged with a
// "[DEMO]" marker in the description so the block below is safely re-runnable: it checks
// for that marker instead of blindly re-inserting on every `npm run db:seed`.
const DEMO_PHONE = '+255700000001';
const DEMO_LISTINGS: Array<{
  category: string;
  subtype: string;
  label: string;
  estimatedWeightKg: number;
  description: string;
  // Real photo files under apps/web/public/materials/ — undefined (not a placeholder
  // URL) where no real, license-clear photo exists yet, rather than hotlinking or
  // fabricating one. See prisma/seed.ts's main() for how this becomes WasteListing.photos.
  photo?: string;
}> = [
  { category: 'plastic', subtype: 'PET', label: 'PET Plastic Bottles', estimatedWeightKg: 25, description: 'Clean PET plastic bottles collected from a household. [DEMO]', photo: '/materials/plastic-bottles.png?v=2' },
  { category: 'metal', subtype: 'ALUMINUM', label: 'Aluminium Cans', estimatedWeightKg: 15, description: 'Sorted aluminium cans, rinsed and flattened. [DEMO]' },
  { category: 'cardboard', subtype: 'CORRUGATED', label: 'Cardboard', estimatedWeightKg: 40, description: 'Flattened corrugated cardboard, dry and clean. [DEMO]', photo: '/materials/cardboard.jpg?v=2' },
  { category: 'metal', subtype: 'STEEL', label: 'Metal Scrap', estimatedWeightKg: 50, description: 'Mixed steel/tin scrap from home repairs. [DEMO]' },
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

  for (const price of PRICES) {
    await prisma.wastePrice.upsert({
      where: { category: price.category },
      update: {},
      create: price,
    });
  }
  console.log(`Seeded ${PRICES.length} reference prices.`);

  const alreadySeeded = await prisma.wasteListing.findFirst({ where: { description: { contains: '[DEMO]' } } });
  if (alreadySeeded) {
    console.log('Demo listings already present — skipping.');
  } else {
    const demoUser = await prisma.user.upsert({
      where: { phone: DEMO_PHONE },
      update: {},
      create: { phone: DEMO_PHONE, name: 'Amina (Demo Household)', role: 'household', verificationStatus: 'verified' },
    });
    const demoLocation = await prisma.location.create({
      data: { ownerType: 'user', userId: demoUser.id, label: 'Home', region: 'Arusha', country: 'TZ' },
    });

    for (const item of DEMO_LISTINGS) {
      const material = await prisma.wasteMaterial.findUnique({
        where: { category_subtype: { category: item.category, subtype: item.subtype } },
      });
      const price = PRICES.find((p) => p.category === item.category);
      if (!material || !price) continue;

      await prisma.wasteListing.create({
        data: {
          sellerId: demoUser.id,
          materialId: material.id,
          locationId: demoLocation.id,
          estimatedWeightKg: item.estimatedWeightKg,
          condition: 'Clean',
          askingPrice: Math.round(price.pricePerKg * item.estimatedWeightKg),
          pickupOption: 'collection_required',
          description: item.description,
          status: 'ACTIVE',
          moderationStatus: 'APPROVED',
          photos: item.photo ? JSON.stringify([item.photo]) : undefined,
        },
      });
    }
    console.log(`Seeded ${DEMO_LISTINGS.length} demo marketplace listings under ${DEMO_PHONE}.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
