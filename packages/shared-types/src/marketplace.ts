// Phase 2 domain enums shared between apps/api and apps/web — marketplace/listing side
// of the core CYCLO loop (see master prompt §14/§15, CYCLO_IMPLEMENTATION_PLAN.md §12).
// Same pattern as roles.ts: Prisma stores these as validated strings (SQLite has no
// native enum type), this module is the single source of truth for allowed values.

export const WASTE_CATEGORIES = [
  "plastic",
  "paper_cardboard",
  "metal",
  "glass",
  "e_waste",
  "textile",
  "rubber",
] as const;
export type WasteCategory = (typeof WASTE_CATEGORIES)[number];

export const PICKUP_OPTIONS = ["seller_dropoff", "collection_required", "flexible"] as const;
export type PickupOption = (typeof PICKUP_OPTIONS)[number];

export const QUANTITY_UNITS = ["kg", "tonnes", "pieces", "litres"] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export const LISTING_CONDITIONS = ["Clean", "Sorted", "Mixed", "Compressed", "Damaged", "Other"] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

// §15 — explicit states, not booleans. DISPUTED has no forward transition defined yet;
// dispute resolution (master prompt §28, plan Phase 4) will extend this table when built.
export const LISTING_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "OFFER_RECEIVED",
  "NEGOTIATION",
  "RESERVED",
  "SOLD",
  "COLLECTED",
  "CANCELLED",
  "EXPIRED",
  "DISPUTED",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

// The only transitions the domain layer accepts. Anything not listed here is rejected
// regardless of what a client sends (§15). Kept alongside the enum so API and any future
// consumer (web/mobile) reason about the same table instead of re-deriving it.
export const LISTING_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["OFFER_RECEIVED", "RESERVED", "CANCELLED", "EXPIRED"],
  OFFER_RECEIVED: ["NEGOTIATION", "ACTIVE", "CANCELLED"],
  NEGOTIATION: ["RESERVED", "ACTIVE", "CANCELLED"],
  RESERVED: ["SOLD", "ACTIVE", "CANCELLED"],
  SOLD: ["COLLECTED", "DISPUTED"],
  COLLECTED: ["DISPUTED"],
  CANCELLED: [],
  EXPIRED: [],
  DISPUTED: [],
};

export function canTransitionListing(from: ListingStatus, to: ListingStatus): boolean {
  return LISTING_TRANSITIONS[from].includes(to);
}
