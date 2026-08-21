const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

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

export interface WasteListing {
  id: string;
  sellerId: string;
  materialId: string;
  locationId: string;
  estimatedWeightKg: number;
  verifiedWeightKg: number | null;
  condition: string | null;
  grade: string | null;
  askingPrice: number | null;
  pickupOption: string;
  description: string | null;
  status: ListingStatus;
  createdAt: string;
  material: WasteMaterial;
  location: Location;
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

export const api = {
  requestOtp: (phone: string) =>
    request<{ message: string; expiresInSeconds: number }>("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  verifyOtp: (input: { phone: string; code: string; name?: string; role?: string }) =>
    request<AuthTokens>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  me: () => request<CurrentUser>("/users/me", { method: "GET" }, true),

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
    condition?: string;
    askingPrice?: number;
    pickupOption: string;
    description?: string;
  }) => request<WasteListing>("/listings", { method: "POST", body: JSON.stringify(input) }, true),
  myListings: () => request<WasteListing[]>("/listings/mine", { method: "GET" }, true),
  browseListings: () => request<WasteListing[]>("/listings", { method: "GET" }, true),
  getListing: (id: string) => request<WasteListing>(`/listings/${id}`, { method: "GET" }, true),
  publishListing: (id: string) => request<WasteListing>(`/listings/${id}/publish`, { method: "PATCH" }, true),
  cancelListing: (id: string) => request<WasteListing>(`/listings/${id}/cancel`, { method: "PATCH" }, true),

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
};
