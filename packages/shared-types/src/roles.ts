// Phase 1 domain enums shared between apps/api and apps/web.
// These are the source of truth for allowed values that the Prisma schema stores
// as plain strings (see prisma/schema.prisma header for why). Extend here first,
// then in the database, never the other way around.

export const USER_ROLES = [
  "household",
  "business",
  "collector",
  "recycler",
  "authority",
  "admin",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORGANIZATION_TYPES = ["business", "recycler", "authority"] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const VERIFICATION_STATUSES = [
  "unverified",
  "pending",
  "verified",
  "rejected",
  "suspended",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const COLLECTOR_AVAILABILITY = ["online", "offline"] as const;
export type CollectorAvailability = (typeof COLLECTOR_AVAILABILITY)[number];
