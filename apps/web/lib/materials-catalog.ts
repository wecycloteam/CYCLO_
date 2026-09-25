export interface CatalogMaterial {
  code: string;
  title: string;
  category: string;
  // The real taxonomy category (see prisma/seed.ts's MATERIALS / WasteMaterial.category)
  // this catalog entry corresponds to — used to find and link to an actual matching
  // listing, distinct from `category` above (a marketing display label).
  realCategory: string;
  detail: string;
  description: string;
  price: string;
  rating: string;
  reviews: number;
  // Undefined where no real, license-clear photo exists yet, rather than hotlinking or
  // fabricating one — the page renders a plain gradient card for those instead.
  image?: string;
  acceptedForms: string[];
}

// The full 7-category taxonomy CYCLO deals in (see prisma/seed.ts MATERIALS and
// packages/shared-types/src/marketplace.ts WASTE_CATEGORIES) — shared between the public
// landing page teaser cards and the /materials/[code] detail page so both always show
// the same numbers — see app/page.tsx and app/materials/[code]/page.tsx.
export const MATERIALS_CATALOG: CatalogMaterial[] = [
  {
    code: "PLA",
    title: "Plastic waste",
    category: "Plastic",
    realCategory: "plastic",
    detail: "Bottles, containers and packaging.",
    description:
      "Bottles, containers and packaging — clean, rinsed plastic earns the best rate. This is one of the highest-demand materials on CYCLO because recyclers can bale and export it directly.",
    price: "TZS 500 / kg",
    rating: "4.9",
    reviews: 128,
    image: "/materials/plastic-bottles.png?v=2",
    acceptedForms: ["Bottles (cap removed)", "Rinsed containers", "Packaging"],
  },
  {
    code: "PPC",
    title: "Paper & cardboard",
    category: "Paper & cardboard",
    realCategory: "paper_cardboard",
    detail: "Boxes, newspapers, office paper.",
    description:
      "Boxes, newspapers and office paper ready for reuse or recycling. Dry, uncontaminated material (no food grease, no wet paper) moves fastest through the marketplace.",
    price: "TZS 180 / kg",
    rating: "4.8",
    reviews: 94,
    image: "/materials/cardboard.jpg?v=2",
    acceptedForms: ["Flattened boxes", "Newspapers", "Office paper"],
  },
  {
    code: "MET",
    title: "Metal waste",
    category: "Metal",
    realCategory: "metal",
    detail: "Aluminium cans and scrap metal.",
    description:
      "Aluminium cans and scrap metal — sorted, rinsed metal earns the highest reference price on CYCLO of any category.",
    price: "TZS 1,200 / kg",
    rating: "4.8",
    reviews: 61,
    image: "/materials/aluminum-cans.jpg",
    acceptedForms: ["Aluminium cans", "Scrap metal", "Steel/tin"],
  },
  {
    code: "GLA",
    title: "Glass waste",
    category: "Glass",
    realCategory: "glass",
    detail: "Bottles and glass containers.",
    description:
      "Bottles and glass containers — sorted and unbroken glass is easiest to move on to a recycler and earns the best rate.",
    price: "TZS 100 / kg",
    rating: "4.6",
    reviews: 38,
    acceptedForms: ["Bottles", "Glass containers"],
  },
  {
    code: "EWA",
    title: "E-waste",
    category: "E-waste",
    realCategory: "e_waste",
    detail: "Old electronics, cables, components.",
    description:
      "Old electronics, cables and components — a high-value category since recyclers recover metals and parts from it directly.",
    price: "TZS 2,000 / kg",
    rating: "4.9",
    reviews: 52,
    image: "/materials/ewaste.jpg",
    acceptedForms: ["Electronics", "Cables", "Components", "Batteries"],
  },
  {
    code: "TEX",
    title: "Textile waste",
    category: "Textile",
    realCategory: "textile",
    detail: "Clothes, fabric, offcuts.",
    description:
      "Clothes, fabric and offcuts in wearable or reusable condition. Sorted, clean textiles move fastest through the marketplace.",
    price: "TZS 300 / kg",
    rating: "4.7",
    reviews: 76,
    image: "/materials/newtextiles.jpg",
    acceptedForms: ["Clothing", "Fabric", "Offcuts"],
  },
  {
    code: "RUB",
    title: "Rubber waste",
    category: "Rubber",
    realCategory: "rubber",
    detail: "Tyres and rubber materials.",
    description:
      "Tyres and rubber materials — collected for retreading, repurposing or safe processing by a verified recycler.",
    price: "TZS 250 / kg",
    rating: "4.5",
    reviews: 21,
    acceptedForms: ["Tyres", "Rubber offcuts"],
  },
];

export function getMaterialByCode(code: string): CatalogMaterial | undefined {
  return MATERIALS_CATALOG.find((m) => m.code.toLowerCase() === code.toLowerCase());
}
