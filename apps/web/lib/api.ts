export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// Phase 1 keeps tokens in localStorage for simplicity. Moving to httpOnly cookies
// is a known hardening item before production (see CYCLO_IMPLEMENTATION_PLAN.md §42).
const ACCESS_KEY = "cyclo.accessToken";
const REFRESH_KEY = "cyclo.refreshToken";

export const tokenStore = {
  getAccess: () => (typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY)),
  getRefresh: () => (typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY)),
  set: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (auth) {
    const token = tokenStore.getAccess();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.message ?? "We couldn't complete that request. Please try again.";
    throw new ApiError(res.status, Array.isArray(message) ? message.join(" ") : message);
  }
  return body as T;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface CurrentUser {
  id: string;
  phone: string;
  name: string;
  role: string;
  verificationStatus: string;
  locale: string;
  country: string;
  createdAt: string;
}

export interface Location {
  id: string;
  label: string;
  addressLine: string | null;
  region: string | null;
  country: string;
}

export interface WasteMaterial {
  id: string;
  category: string;
  subtype: string;
  label: string;
  recyclable: boolean;
}

// Mirrors packages/shared-types/src/marketplace.ts LISTING_STATUSES.
export type ListingStatus =
  | "DRAFT"
  | "ACTIVE"
  | "OFFER_RECEIVED"
  | "NEGOTIATION"
  | "RESERVED"
  | "SOLD"
  | "COLLECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "DISPUTED";

export interface PublicSeller {
  id: string;
  name: string;
  verificationStatus: string;
}

export type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface WasteListing {
  id: string;
  sellerId: string;
  materialId: string;
  locationId: string;
  estimatedWeightKg: number;
  verifiedWeightKg: number | null;
  quantityUnit: string;
  condition: string | null;
  grade: string | null;
  photos: string[];
  askingPrice: number | null;
  pickupOption: string;
  description: string | null;
  status: ListingStatus;
  moderationStatus: ModerationStatus;
  createdAt: string;
  material: WasteMaterial;
  location: Location;
  seller: PublicSeller;
}

// A listing's true public status is status + moderationStatus combined — ACTIVE alone
// just means the seller published it, not that it's admin-approved yet (§15 vs the
// moderation gate in CYCLO_IMPLEMENTATION_PLAN.md's "Admin foundation" section).
export function listingStatusLabel(listing: Pick<WasteListing, "status" | "moderationStatus">): string {
  if (listing.status === "ACTIVE" && listing.moderationStatus === "PENDING") return "Pending Verification";
  if (listing.status === "ACTIVE" && listing.moderationStatus === "REJECTED") return "Rejected";
  if (listing.status === "ACTIVE") return "Approved";
  return listing.status.replace(/_/g, " ");
}

// Mirrors packages/shared-types/src/collection.ts PICKUP_STATUSES.
export type PickupStatus =
  | "CREATED"
  | "MATCHING"
  | "ASSIGNED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "COLLECTING"
  | "WEIGHED"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";

export interface Transaction {
  id: string;
  reference: string;
  verifiedWeightKg: number;
  agreedPrice: number | null;
  platformFee: number;
  netAmount: number | null;
  paymentStatus: string;
  createdAt: string;
}

export interface PickupRequest {
  id: string;
  producerId: string;
  locationId: string;
  materialId: string;
  listingId: string | null;
  estimatedWeightKg: number;
  verifiedWeightKg: number | null;
  weightMethod: string | null;
  preferredTime: string | null;
  notes: string | null;
  status: PickupStatus;
  assignedCollectorId: string | null;
  createdAt: string;
  material: WasteMaterial;
  location: Location;
  transaction?: Transaction | null;
  producer?: { id: string; name: string };
  estimatedValue?: number | null;
}

export interface WasteEvent {
  id: string;
  eventType: string;
  actorId: string | null;
  notes: string | null;
  previousState: string | null;
  newState: string | null;
  createdAt: string;
}

export interface AdminDashboard {
  totalUsers: number;
  usersByRole: Record<string, number>;
  usersByVerificationStatus: Record<string, number>;
  collectorsByVerificationStatus: Record<string, number>;
  organizationsByVerificationStatus: Record<string, number>;
  listingsByStatus: Record<string, number>;
  pendingListingModerationCount: number;
  pickupsByStatus: Record<string, number>;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: string | null;
  createdAt: string;
}

export interface PendingAccount {
  id: string;
  name: string;
  phone: string;
  role: string;
  verificationStatus: string;
  createdAt: string;
}

export interface PendingCollector {
  userId: string;
  verificationStatus: string;
  vehicleType: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string; createdAt: string };
}

export interface PendingOrganization {
  id: string;
  type: string;
  name: string;
  verificationStatus: string;
  ownerUserId: string;
  createdAt: string;
  owner: { id: string; name: string; phone: string };
}

export interface AdminPendingListing extends Omit<WasteListing, "seller"> {
  seller: {
    id: string;
    name: string;
    phone: string;
    role: string;
    collectorProfile: { verificationStatus: string } | null;
    organizationMemberships: { organization: { id: string; name: string; type: string; verificationStatus: string } }[];
  };
}

export interface ClassificationResult {
  category: string;
  subtype: string | null;
  label: string;
  confidence: number;
  recyclable: boolean;
  handlingInstructions: string[];
  recommendedAction: string;
  mock: boolean;
  condition?: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  conditionNotes?: string;
  estimatedCapacity?: string | null;
  unitPriceTZS?: number;
  unitPriceUSD?: number;
}

export interface ChatMessage {
  role: "user" | "model";
  parts: string;
}

export interface ScanResponse {
  scanId: string;
  result: ClassificationResult;
  suggestedMaterialId: string | null;
}

export interface WastePrice {
  category: string;
  pricePerKg: number;
  updatedAt: string;
}

export interface SellerContact {
  name: string;
  phone: string;
}

export interface ImpactStats {
  asSeller: {
    completedCount: number;
    wasteRecycledKg: number;
    estimatedEarnings: number;
    co2AvoidedKg: number;
  };
  asCollector: {
    completedCount: number;
    collectedWeightKg: number;
  };
}

export const api = {
  requestOtp: (phone: string) =>
    // devCode is only ever present when the API's bound SmsProvider is a non-delivering
    // dev stub (see apps/api SmsProvider.exposesCodeInResponse) — never in production.
    request<{ message: string; expiresInSeconds: number; devCode?: string }>("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  verifyOtp: (input: { phone: string; code: string; name?: string; role?: string }) =>
    request<AuthTokens>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  register: (input: { email: string; password: string; phone: string; name: string; role?: string }) =>
    request<AuthTokens>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (input: { email: string; password: string }) =>
    request<AuthTokens>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  me: () => request<CurrentUser>("/users/me", { method: "GET" }, true),
  myImpact: () => request<ImpactStats>("/users/me/impact", { method: "GET" }, true),

  logout: (refreshToken: string) =>
    request<{ message: string }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  // Locations
  createLocation: (input: { label: string; addressLine?: string; region?: string; country?: string }) =>
    request<Location>("/locations", { method: "POST", body: JSON.stringify(input) }, true),
  myLocations: () => request<Location[]>("/locations/mine", { method: "GET" }, true),

  // Waste materials (taxonomy)
  wasteMaterials: () => request<WasteMaterial[]>("/waste-materials", { method: "GET" }, true),

  // Marketplace / listings
  createListing: (input: {
    materialId: string;
    locationId: string;
    estimatedWeightKg: number;
    quantityUnit?: string;
    condition?: string;
    askingPrice?: number;
    photos?: string[];
    pickupOption: string;
    description?: string;
  }) => request<WasteListing>("/listings", { method: "POST", body: JSON.stringify(input) }, true),
  myListings: () => request<WasteListing[]>("/listings/mine", { method: "GET" }, true),
  browseListings: () => request<WasteListing[]>("/listings", { method: "GET" }, true),
  getListing: (id: string) => request<WasteListing>(`/listings/${id}`, { method: "GET" }, true),
  publishListing: (id: string) => request<WasteListing>(`/listings/${id}/publish`, { method: "PATCH" }, true),
  cancelListing: (id: string) => request<WasteListing>(`/listings/${id}/cancel`, { method: "PATCH" }, true),
  contactSeller: (id: string) => request<SellerContact>(`/listings/${id}/contact`, { method: "GET" }, true),

  // Transparent pricing (§17)
  wastePrices: () => request<WastePrice[]>("/waste-prices", { method: "GET" }, true),
  adminSetPrice: (category: string, pricePerKg: number) =>
    request<WastePrice>(`/admin/waste-prices/${category}`, { method: "PATCH", body: JSON.stringify({ pricePerKg }) }, true),

  // Pickup requests / collection
  createPickupRequest: (input: {
    locationId: string;
    listingId?: string;
    materialId?: string;
    estimatedWeightKg?: number;
    preferredTime?: string;
    notes?: string;
  }) => request<PickupRequest>("/pickup-requests", { method: "POST", body: JSON.stringify(input) }, true),
  myPickupRequests: () => request<PickupRequest[]>("/pickup-requests/mine", { method: "GET" }, true),
  openPickupJobs: () => request<PickupRequest[]>("/pickup-requests/open", { method: "GET" }, true),
  assignedPickupJobs: () => request<PickupRequest[]>("/pickup-requests/assigned", { method: "GET" }, true),
  getPickupRequest: (id: string) => request<PickupRequest>(`/pickup-requests/${id}`, { method: "GET" }, true),
  pickupEvents: (id: string) => request<WasteEvent[]>(`/pickup-requests/${id}/events`, { method: "GET" }, true),
  acceptPickup: (id: string) =>
    request<PickupRequest>(`/pickup-requests/${id}/accept`, { method: "PATCH" }, true),
  pickupEnRoute: (id: string) =>
    request<PickupRequest>(`/pickup-requests/${id}/en-route`, { method: "PATCH" }, true),
  pickupArrive: (id: string) =>
    request<PickupRequest>(`/pickup-requests/${id}/arrive`, { method: "PATCH" }, true),
  pickupStartCollecting: (id: string) =>
    request<PickupRequest>(`/pickup-requests/${id}/start-collecting`, { method: "PATCH" }, true),
  recordPickupWeight: (id: string, input: { verifiedWeightKg: number; method?: string }) =>
    request<PickupRequest>(`/pickup-requests/${id}/weigh`, { method: "PATCH", body: JSON.stringify(input) }, true),
  completePickup: (id: string) =>
    request<Transaction>(`/pickup-requests/${id}/complete`, { method: "PATCH" }, true),
  cancelPickup: (id: string) =>
    request<PickupRequest>(`/pickup-requests/${id}/cancel`, { method: "PATCH" }, true),

  // Admin
  adminDashboard: () => request<AdminDashboard>("/admin/dashboard", { method: "GET" }, true),
  adminActivity: () => request<AuditLogEntry[]>("/admin/activity", { method: "GET" }, true),
  adminPendingUsers: () =>
    request<{ pendingAccounts: PendingAccount[]; pendingCollectors: PendingCollector[]; pendingOrganizations: PendingOrganization[] }>(
      "/admin/users/pending",
      { method: "GET" },
      true,
    ),
  adminVerifyUser: (userId: string) => request(`/admin/users/${userId}/verify`, { method: "PATCH" }, true),
  adminRejectUser: (userId: string, reason?: string) =>
    request(`/admin/users/${userId}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }, true),
  adminSuspendUser: (userId: string, reason?: string) =>
    request(`/admin/users/${userId}/suspend`, { method: "PATCH", body: JSON.stringify({ reason }) }, true),
  adminVerifyCollector: (userId: string) =>
    request(`/admin/collectors/${userId}/verify`, { method: "PATCH" }, true),
  adminRejectCollector: (userId: string, reason?: string) =>
    request(`/admin/collectors/${userId}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }, true),
  adminSuspendCollector: (userId: string, reason?: string) =>
    request(`/admin/collectors/${userId}/suspend`, { method: "PATCH", body: JSON.stringify({ reason }) }, true),
  adminVerifyOrganization: (orgId: string) =>
    request(`/admin/organizations/${orgId}/verify`, { method: "PATCH" }, true),
  adminRejectOrganization: (orgId: string, reason?: string) =>
    request(`/admin/organizations/${orgId}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }, true),
  adminSuspendOrganization: (orgId: string, reason?: string) =>
    request(`/admin/organizations/${orgId}/suspend`, { method: "PATCH", body: JSON.stringify({ reason }) }, true),
  adminPendingListings: () => request<AdminPendingListing[]>("/admin/listings/pending", { method: "GET" }, true),
  adminApproveListing: (id: string) => request<WasteListing>(`/admin/listings/${id}/approve`, { method: "PATCH" }, true),
  adminRejectListing: (id: string, reason?: string) =>
    request<WasteListing>(`/admin/listings/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }, true),

  // AI waste scanning (§11-§13) — see ClassificationResult.mock for whether this scan
  // came from the real Gemini classifier or the demo fallback.
  scanWaste: (imageBase64: string) =>
    request<ScanResponse>("/ai/scan", { method: "POST", body: JSON.stringify({ imageBase64 }) }, true),
  confirmScan: (scanId: string, finalMaterialId: string) =>
    request(`/ai/scans/${scanId}/confirm`, { method: "PATCH", body: JSON.stringify({ finalMaterialId }) }, true),

  // Cyclo Assistant — Gemini-backed chat for recycling/sorting/pricing guidance.
  chatWithAssistant: (message: string, history?: ChatMessage[]) =>
    request<{ reply: string }>("/ai/chat", { method: "POST", body: JSON.stringify({ message, history }) }, true),
};
