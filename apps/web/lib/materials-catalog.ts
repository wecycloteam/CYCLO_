export interface CatalogMaterial {
  code: string;
  title: string;
  category: string;
  // The real taxonomy category (see prisma/seed.ts's MATERIALS / WasteMaterial.category)
  // this catalog entry corresponds to — used to find and link to an actual matching
  // listing, distinct from `category` above (a marketing display label, e.g. cardboard's
  // display category is "Paper" but its real taxonomy category is "cardboard").
  realCategory: string;
  detail: string;
  description: string;
  price: string;
  rating: string;
  reviews: number;
  image: string;
  acceptedForms: string[];
}

// Shared between the public landing page teaser cards and the /materials/[code]
// detail page so both always show the same numbers — see app/page.tsx and
// app/materials/[code]/page.tsx.
export const MATERIALS_CATALOG: CatalogMaterial[] = [
  {
    code: "PET",
    title: "Plastic bottles & containers",
    category: "Plastic",
    realCategory: "plastic",
    detail: "Water bottles, cooking oil containers and clean packaging.",
    description:
      "Clean PET and HDPE plastic — water bottles, cooking oil containers and food-safe packaging. Rinsed and cap-off material earns the best rate. This is one of the highest-demand materials on CYCLO because recyclers can bale and export it directly.",
    price: "TZS 850 / kg",
    rating: "4.9",
    reviews: 128,
    image: "/materials/plastic-bottles.png?v=2",
    acceptedForms: ["Bottles (cap removed)", "Rinsed containers", "Clear or lightly coloured plastic"],
  },
  {
    code: "BOX",
    title: "Cardboard",
    category: "Paper",
    realCategory: "cardboard",
    detail: "Boxes, cartons and flattened packaging ready for reuse or recycling.",
    description:
      "Boxes, cartons and flattened packaging ready for reuse or recycling. Dry, uncontaminated cardboard (no food grease, no wet material) is collected in bulk and moves fastest through the marketplace.",
    price: "TZS 500 / kg",
    rating: "4.8",
    reviews: 94,
    image: "/materials/cardboard.jpg?v=2",
    acceptedForms: ["Flattened boxes", "Cartons", "Clean packaging paper"],
  },
  {
    code: "TEE",
    title: "Textiles",
    category: "Textiles",
    realCategory: "textile",
    detail: "Second-hand clothes, shoes, bags and fabric in wearable condition.",
    description:
      "Second-hand clothes, shoes, bags and fabric in wearable or repairable condition. Sorted, clean textiles are priced per item rather than by weight since condition varies more than for other materials.",
    price: "TZS 3,500 / item",
    rating: "4.7",
    reviews: 76,
    image: "/materials/textiles.jpg?v=2",
    acceptedForms: ["Clothing", "Shoes", "Bags", "Fabric offcuts"],
  },
  {
    code: "PPR",
    title: "Paper",
    category: "Paper",
    realCategory: "paper",
    detail: "Office paper, newspapers, magazines and sorted paper bundles.",
    description:
      "Office paper, newspapers, magazines and sorted paper bundles. Keeping paper dry and separated from cardboard and plastic gets you the transparent reference price shown here, updated by CYCLO's pricing team.",
    price: "TZS 650 / kg",
    rating: "4.6",
    reviews: 61,
    image: "/materials/paper.jpg?v=2",
    acceptedForms: ["Office paper", "Newspaper", "Magazines"],
  },
];

export function getMaterialByCode(code: string): CatalogMaterial | undefined {
  return MATERIALS_CATALOG.find((m) => m.code.toLowerCase() === code.toLowerCase());
}
