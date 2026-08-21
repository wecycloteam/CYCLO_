"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, PickupRequest } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

function PickupCard({ pickup }: { pickup: PickupRequest }) {
  return (
    <Link
      href={`/activity/${pickup.id}`}
      className="block rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <span className="text-sm font-extrabold">{pickup.material.label}</span>
        <StatusBadge status={pickup.status} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-2)]">
        <span>📍 {pickup.location.region ?? pickup.location.label}</span>
        <span>⚖️ {pickup.verifiedWeightKg ?? pickup.estimatedWeightKg} kg</span>
        {pickup.transaction && <span>🧾 {pickup.transaction.reference}</span>}
      </div>
    </Link>
  );
}

export default function ActivityPage() {
  const { state: authState, user } = useCurrentUser();
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!user) return;
    setState("loading");
    const call = user.role === "collector" ? api.assignedPickupJobs() : api.myPickupRequests();
    call
      .then((res) => {
        setPickups(res);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load your activity.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, user?.id]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Activity" />
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label="Loading activity…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}

        {state === "ready" && pickups.length === 0 && (
          <EmptyState
            title={user?.role === "collector" ? "No jobs yet" : "No pickup requests yet"}
            hint={
              user?.role === "collector"
                ? "Accept a job from the open pool to see it here."
                : "Request a pickup for material you want collected."
            }
            action={
              user?.role === "collector" ? (
                <Link href="/jobs" className="inline-block rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm px-5 py-2.5">
                  Browse open jobs
                </Link>
              ) : (
                <Link href="/activity/new" className="inline-block rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm px-5 py-2.5">
                  Request Pickup
                </Link>
              )
            }
          />
        )}

        {state === "ready" && pickups.length > 0 && (
          <div className="flex flex-col gap-2">
            {pickups.map((p) => (
              <PickupCard key={p.id} pickup={p} />
            ))}
          </div>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
