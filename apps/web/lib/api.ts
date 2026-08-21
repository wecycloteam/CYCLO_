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
};
