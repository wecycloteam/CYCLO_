// Phase 2 domain enums shared between apps/api and apps/web — collection/pickup side of
// the core CYCLO loop (master prompt §18/§19/§20, CYCLO_IMPLEMENTATION_PLAN.md §13).

// §20 — explicit states. ASSIGNED exists for a future push-dispatch flow (an
// admin/algorithm assigns a specific collector who must still confirm); the MVP's
// self-service "accept an open job" action goes MATCHING -> ACCEPTED directly.
export const PICKUP_STATUSES = [
  "CREATED",
  "MATCHING",
  "ASSIGNED",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "COLLECTING",
  "WEIGHED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

// DISPUTED has no forward transition yet — dispute resolution (§28, plan Phase 4) extends
// this table when built, same as LISTING_TRANSITIONS.
export const PICKUP_TRANSITIONS: Record<PickupStatus, readonly PickupStatus[]> = {
  CREATED: ["MATCHING", "CANCELLED"],
  MATCHING: ["ASSIGNED", "ACCEPTED", "CANCELLED"],
  ASSIGNED: ["ACCEPTED", "MATCHING", "CANCELLED"],
  ACCEPTED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["COLLECTING", "CANCELLED"],
  COLLECTING: ["WEIGHED", "CANCELLED"],
  WEIGHED: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED"],
  CANCELLED: [],
  DISPUTED: [],
};

export function canTransitionPickup(from: PickupStatus, to: PickupStatus): boolean {
  return PICKUP_TRANSITIONS[from].includes(to);
}

// §26 — payment states. MVP has no real payment provider wired (Phase 5); every
// transaction created by the collection loop starts and stays PENDING until a real
// PaymentProvider abstraction exists. Never set to SUCCESS without an actual provider call.
export const PAYMENT_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "REFUNDED",
  "DISPUTED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// §24 — not DB-enforced (WasteEvent.eventType is a free string so new event types don't
// need a migration), but this is the canonical list new code should use.
export const WASTE_EVENT_TYPES = [
  "LISTING_CREATED",
  "LISTING_PUBLISHED",
  "LISTING_CANCELLED",
  "PICKUP_REQUESTED",
  "PICKUP_MATCHING",
  "PICKUP_ACCEPTED",
  "PICKUP_EN_ROUTE",
  "PICKUP_ARRIVED",
  "PICKUP_COLLECTING",
  "PICKUP_WEIGHED",
  "PICKUP_COMPLETED",
  "PICKUP_CANCELLED",
  "TRANSACTION_CREATED",
] as const;
export type WasteEventType = (typeof WASTE_EVENT_TYPES)[number];
