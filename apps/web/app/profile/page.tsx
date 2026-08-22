"use client";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { LoadingState, ErrorState } from "@/components/AsyncState";

const ROLE_LABELS: Record<string, string> = {
  household: "Household",
  business: "Business",
  collector: "Collector",
  recycler: "Recycling Company",
  authority: "Environmental Authority",
  admin: "CYCLO Admin",
};

const VERIFICATION_LABELS: Record<string, string> = {
  unverified: "Not yet reviewed",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Not approved",
  suspended: "Suspended",
};

export default function ProfilePage() {
  const { state, user, error, retry } = useCurrentUser();

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Profile" />

      <div className="flex-1 max-w-md w-full mx-auto px-6 py-8">
        {state === "loading" && <LoadingState label="Loading your profile…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={retry} />}

        {state === "ready" && user && (
          <>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="h-16 w-16 rounded-full bg-[var(--cyclo-teal)] text-white flex items-center justify-center text-xl font-extrabold mb-3">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-lg font-extrabold">{user.name}</div>
                <VerifiedBadge status={user.verificationStatus} />
              </div>
              <div className="text-sm text-[var(--text-2)]">{user.phone}</div>
            </div>

            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-2)]">Account type</span>
                <span className="text-sm font-bold">{ROLE_LABELS[user.role] ?? user.role}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-2)]">Verification</span>
                <span className="text-sm font-bold">{VERIFICATION_LABELS[user.verificationStatus] ?? user.verificationStatus}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-2)]">Country</span>
                <span className="text-sm font-bold">{user.country}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-2)]">Member since</span>
                <span className="text-sm font-bold">
                  {new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {user && <BottomNav role={user.role} />}
    </main>
  );
}
