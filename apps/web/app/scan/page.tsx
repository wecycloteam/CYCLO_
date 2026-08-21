"use client";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState, LoadingState } from "@/components/AsyncState";

// AI classification (master prompt §11-§13) is Phase 3 — not built yet. This page exists
// so the nav shape matches §9 now, but it never claims scanning works (§62: don't claim
// functionality that isn't implemented).
export default function ScanPage() {
  const { state, user } = useCurrentUser();

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Scan Waste" />
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-8">
        {state === "loading" && <LoadingState />}
        {state === "ready" && (
          <EmptyState
            title="AI scanning is coming soon"
            hint="Waste identification via camera is planned for a later phase. For now, you can list materials manually from the Marketplace tab."
          />
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
