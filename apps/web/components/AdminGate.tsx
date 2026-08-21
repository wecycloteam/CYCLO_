"use client";

import { CurrentUser } from "@/lib/api";
import { LoadingState } from "@/components/AsyncState";

// §38 of the moderation spec: unauthenticated -> redirect to login (useCurrentUser
// already does this); authenticated-but-wrong-role -> "Access denied", not a silent
// redirect and not just a hidden nav button — the API enforces this too (RolesGuard),
// this is a UX layer on top of a real server-side check, not a substitute for one.
export function AdminGate({
  authState,
  user,
  children,
}: {
  authState: "loading" | "ready" | "error";
  user: CurrentUser | null;
  children: React.ReactNode;
}) {
  if (authState === "loading") return <LoadingState label="Checking access…" />;
  if (authState !== "ready" || !user) return null;

  if (user.role !== "admin") {
    return (
      <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm font-bold text-[var(--text-1)] mb-1">Access denied</p>
        <p className="text-xs text-[var(--text-2)]">This area is for CYCLO administrators only.</p>
      </div>
    );
  }

  return <>{children}</>;
}
