// Admin/moderation domain enums, shared between apps/api and apps/web.

// §14/§15 of the moderation spec — orthogonal to WasteListing's operational state
// machine (see marketplace.ts). A listing must reach ACTIVE (the seller's publish
// action) *and* APPROVED here before it's publicly discoverable.
export const MODERATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

// Canonical admin-action names for AuditLog.action — a free string in the DB (no
// migration needed to add one), this is just the agreed vocabulary for new code.
export const ADMIN_ACTIONS = [
  "COLLECTOR_VERIFIED",
  "COLLECTOR_REJECTED",
  "COLLECTOR_SUSPENDED",
  "ORGANIZATION_VERIFIED",
  "ORGANIZATION_REJECTED",
  "ORGANIZATION_SUSPENDED",
  "LISTING_APPROVED",
  "LISTING_REJECTED",
] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];
