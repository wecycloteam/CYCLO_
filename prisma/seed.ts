// Seeds the canonical waste-material taxonomy (master prompt §11, §14).
// Idempotent — safe to re-run after editing the list below; upserts by the
// (category, subtype) unique constraint instead of wiping the table, so listings
// that already reference a material row are never orphaned by a re-seed.
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

// The full catalog CYCLO deals in — deliberately just these 7 categories, one row
// each (no per-subtype breakdown), per an explicit product decision to keep the
// material picker simple rather than exposing a long plastic-resin/glass-color taxonomy.
const MATERIALS: Array<{
  category: string;
  subtype: string;
  label: string;
  recyclable: boolean;
}> = [
  { category: 'plastic', subtype: 'GENERAL', label: 'Plastic waste (bottles, containers, packaging etc)', recyclable: true },
  { category: 'paper_cardboard', subtype: 'GENERAL', label: 'Paper & cardboard (boxes, newspapers, office paper etc)', recyclable: true },
  { category: 'metal', subtype: 'GENERAL', label: 'Metal waste (aluminium cans, scrap metal etc)', recyclable: true },
  { category: 'glass', subtype: 'GENERAL', label: 'Glass waste (bottles and glass containers etc)', recyclable: true },
  { category: 'e_waste', subtype: 'GENERAL', label: 'E-waste (old electronics, cables, components etc)', recyclable: true },
  { category: 'textile', subtype: 'GENERAL', label: 'Textile waste (clothes, fabric, offcuts etc)', recyclable: true },
  { category: 'rubber', subtype: 'GENERAL', label: 'Rubber waste (tyres and rubber materials etc)', recyclable: true },
];

// §17 — reference prices (TZS/kg) shown as "Estimated Market Value" everywhere and
// editable from the admin dashboard. Approximate real-world East Africa scrap-value
// ordering (metal/e-waste highest, organic/mixed lowest) — a starting point, not a claim
// of accuracy; admins are expected to correct these to real market rates.
const PRICES: Array<{ category: string; pricePerKg: number }> = [
  { category: 'plastic', pricePerKg: 500 },
  { category: 'paper_cardboard', pricePerKg: 180 },
  { category: 'textile', pricePerKg: 300 },
  { category: 'glass', pricePerKg: 100 },
  { category: 'metal', pricePerKg: 1200 },
  { category: 'e_waste', pricePerKg: 2000 },
  { category: 'rubber', pricePerKg: 250 },
];

// §14 — sample listings so the marketplace is never empty on a fresh database. Idempotency
// is keyed off DEMO_PHONE (a reserved, obviously-fake number no real signup would ever use)
// rather than any marker inside user-facing text — an earlier version used a "[DEMO]"
// string inside the description/name fields for this, which leaked directly into what
// real visitors saw on the listing detail page and seller name.
const DEMO_PHONE = '+255621748359';
// Distinct sellers (real-looking Tanzanian names/numbers, not a AAAA-then-sequential
// pattern) so the marketplace doesn't read as one person listing everything.
const DEMO_SELLERS = [
  { key: 'amina', name: 'Amina Juma', phone: DEMO_PHONE, region: 'Arusha' },
  { key: 'neema', name: 'Neema Kileo', phone: '+255754821637', region: 'Dar es Salaam' },
  { key: 'baraka', name: 'Baraka Mushi', phone: '+255786402951', region: 'Mwanza' },
  { key: 'fatuma', name: 'Fatuma Ally', phone: '+255715639284', region: 'Dodoma' },
  { key: 'godfrey', name: 'Godfrey Massawe', phone: '+255767193508', region: 'Moshi' },
] as const;

const DEMO_LISTINGS: Array<{
  category: string;
  subtype: string;
  label: string;
  estimatedWeightKg: number;
  description: string;
  seller: (typeof DEMO_SELLERS)[number]['key'];
  // Real photo files under apps/web/public/materials/ — undefined (not a placeholder
  // URL) where no real, license-clear photo exists yet, rather than hotlinking or
  // fabricating one. See prisma/seed.ts's main() for how this becomes WasteListing.photos.
  photo?: string;
}> = [
  { category: 'plastic', subtype: 'GENERAL', label: 'Plastic Bottles', estimatedWeightKg: 25, description: 'Clean plastic bottles collected from a household.', seller: 'amina', photo: '/materials/plastic-bottles.jpg' },
  { category: 'metal', subtype: 'GENERAL', label: 'Aluminium Cans', estimatedWeightKg: 15, description: 'Sorted aluminium cans, rinsed and flattened.', seller: 'neema', photo: '/materials/aluminum-cans.jpg' },
  { category: 'paper_cardboard', subtype: 'GENERAL', label: 'Cardboard', estimatedWeightKg: 40, description: 'Flattened corrugated cardboard, dry and clean.', seller: 'baraka', photo: '/materials/cardboard.jpg?v=2' },
  { category: 'metal', subtype: 'GENERAL', label: 'Metal Scrap', estimatedWeightKg: 50, description: 'Mixed steel/tin scrap from home repairs.', seller: 'fatuma', photo: '/materials/steel-tin.jpg' },
  { category: 'paper_cardboard', subtype: 'GENERAL', label: 'Office Paper', estimatedWeightKg: 20, description: 'Sorted office paper and newspaper bundles, kept dry.', seller: 'godfrey', photo: '/materials/paper.jpg?v=2' },
  { category: 'textile', subtype: 'GENERAL', label: 'Used Clothing', estimatedWeightKg: 10, description: 'Second-hand clothes and fabric offcuts, sorted and clean.', seller: 'neema', photo: '/materials/newtextiles.jpg' },
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

  const alreadySeeded = await prisma.user.findUnique({ where: { phone: DEMO_PHONE } });
  if (alreadySeeded) {
    console.log('Sample listings already present — skipping.');
  } else {
    const sellersByKey = new Map<string, { userId: string; locationId: string }>();
    for (const s of DEMO_SELLERS) {
      const user = await prisma.user.upsert({
        where: { phone: s.phone },
        update: {},
        create: { phone: s.phone, name: s.name, role: 'household', verificationStatus: 'verified' },
      });
      const location = await prisma.location.create({
        data: { ownerType: 'user', userId: user.id, label: 'Home', region: s.region, country: 'TZ' },
      });
      sellersByKey.set(s.key, { userId: user.id, locationId: location.id });
    }

    for (const item of DEMO_LISTINGS) {
      const material = await prisma.wasteMaterial.findUnique({
        where: { category_subtype: { category: item.category, subtype: item.subtype } },
      });
      const price = PRICES.find((p) => p.category === item.category);
      const seller = sellersByKey.get(item.seller);
      if (!material || !price || !seller) continue;

      await prisma.wasteListing.create({
        data: {
          sellerId: seller.userId,
          materialId: material.id,
          locationId: seller.locationId,
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
    console.log(`Seeded ${DEMO_LISTINGS.length} demo marketplace listings across ${DEMO_SELLERS.length} sellers.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
