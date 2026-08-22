"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ImpactStats, PickupRequest, WasteListing } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState, ErrorState } from "@/components/AsyncState";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="text-base font-extrabold">{value}</div>
      <div className="text-[10px] text-[var(--text-2)]">{label}</div>
    </div>
  );
}

// §10 — home answers "what can I do right now": Scan / Sell / Request Pickup / Marketplace,
// then contextual recent activity and real impact stats (derived only from actual
// completed Transaction rows — see UsersService.impact — never a fabricated number).
export default function HomePage() {
  const { state, user, error, retry } = useCurrentUser();
  const [recentListings, setRecentListings] = useState<WasteListing[]>([]);
  const [recentPickups, setRecentPickups] = useState<PickupRequest[]>([]);
  const [impact, setImpact] = useState<ImpactStats | null>(null);

  useEffect(() => {
    if (state !== "ready" || !user) return;
    api.myListings().then(setRecentListings).catch(() => undefined);
    if (user.role === "collector") {
      api.assignedPickupJobs().then(setRecentPickups).catch(() => undefined);
    } else {
      api.myPickupRequests().then(setRecentPickups).catch(() => undefined);
    }
    api.myImpact().then(setImpact).catch(() => undefined);
  }, [state, user]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader />

      <div className="flex-1 max-w-md w-full mx-auto px-6 py-8">
        {state === "loading" && <LoadingState label="Loading your profile…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={retry} />}

        {state === "ready" && user && (
          <>
            <div className="mb-6">
              <div className="text-sm text-[var(--text-2)]">Good to see you</div>
              <div className="text-xl font-extrabold">{user.name}</div>
            </div>

            {user.role !== "collector" ? (
              <div className="grid grid-cols-2 gap-3 mb-8">
                <Link
                  href="/scan"
                  className="col-span-2 rounded-[var(--r-lg)] p-5 text-white relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, var(--cyclo-teal), #1B3E41)" }}
                >
                  <div className="text-xs font-bold uppercase tracking-wide text-[#B9D6D1] mb-1">Get started</div>
                  <div className="text-lg font-extrabold">Scan Waste →</div>
                  <div className="text-xs text-[#C7E3DE] mt-1">Identify and value materials</div>
                </Link>
                <Link
                  href="/marketplace/new"
                  className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="text-2xl mb-1">🏷️</div>
                  <div className="text-sm font-extrabold">Sell Recyclables</div>
                </Link>
                <Link
                  href="/activity/new"
                  className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="text-2xl mb-1">🚚</div>
                  <div className="text-sm font-extrabold">Request Pickup</div>
                </Link>
                <Link
                  href="/marketplace"
                  className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="text-2xl mb-1">🛒</div>
                  <div className="text-sm font-extrabold">Marketplace</div>
                </Link>
              </div>
            ) : (
              <Link
                href="/jobs"
                className="block rounded-[var(--r-lg)] p-5 mb-8 text-white relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, var(--cyclo-teal), #1B3E41)" }}
              >
                <div className="text-xs font-bold uppercase tracking-wide text-[#B9D6D1] mb-1">Collector</div>
                <div className="text-lg font-extrabold">Browse open jobs →</div>
              </Link>
            )}

            {impact && user.role !== "collector" && (
              <div className="grid grid-cols-3 gap-2 mb-8">
                <StatTile label="Waste recycled" value={`${impact.asSeller.wasteRecycledKg} kg`} />
                <StatTile label="Est. earnings" value={`TZS ${Math.round(impact.asSeller.estimatedEarnings).toLocaleString()}`} />
                <StatTile label="Est. CO₂ avoided" value={`${impact.asSeller.co2AvoidedKg} kg`} />
              </div>
            )}
            {impact && user.role === "collector" && (
              <div className="grid grid-cols-2 gap-2 mb-8">
                <StatTile label="Pickups completed" value={`${impact.asCollector.completedCount}`} />
                <StatTile label="Weight collected" value={`${impact.asCollector.collectedWeightKg} kg`} />
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold">
                {user.role === "collector" ? "Your active jobs" : "Your recent activity"}
              </h3>
              <Link href="/activity" className="text-xs font-bold text-[var(--cyclo-teal)]">
                See all
              </Link>
            </div>

            {recentPickups.length === 0 && recentListings.length === 0 && (
              <p className="text-xs text-[var(--text-2)]">Nothing here yet — get started above.</p>
            )}

            <div className="flex flex-col gap-2">
              {recentPickups.slice(0, 3).map((p) => (
                <Link
                  key={p.id}
                  href={`/activity/${p.id}`}
                  className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-bold">{p.material.label}</div>
                    <div className="text-xs text-[var(--text-2)]">{p.estimatedWeightKg} kg est.</div>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))}
              {user.role !== "collector" &&
                recentListings.slice(0, 2).map((l) => (
                  <Link
                    key={l.id}
                    href={`/marketplace/${l.id}`}
                    className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-bold">{l.material.label}</div>
                      <div className="text-xs text-[var(--text-2)]">{l.estimatedWeightKg} kg listed</div>
                    </div>
                    <StatusBadge status={l.status} />
                  </Link>
                ))}
            </div>
          </>
        )}
      </div>

      {user && <BottomNav role={user.role} />}
    </main>
  );
}
