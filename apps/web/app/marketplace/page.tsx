"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, WasteListing } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";

type Tab = "browse" | "mine";
type LoadState = "loading" | "ready" | "error";

function ListingCard({ listing }: { listing: WasteListing }) {
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="block rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <span className="text-sm font-extrabold">{listing.material.label}</span>
        {listing.askingPrice != null && (
          <span className="text-sm font-extrabold text-[var(--cyclo-teal)] whitespace-nowrap">
            TZS {listing.askingPrice.toLocaleString()}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-2)] mb-2">
        <span>📍 {listing.location.region ?? listing.location.label}</span>
        <span>⚖️ {listing.estimatedWeightKg} kg</span>
      </div>
      <StatusBadge status={listing.status} />
    </Link>
  );
}

export default function MarketplacePage() {
  const { state: authState, user } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("browse");
  const [listings, setListings] = useState<WasteListing[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  function load(t: Tab) {
    setState("loading");
    const call = t === "browse" ? api.browseListings() : api.myListings();
    call
      .then((res) => {
        setListings(res);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load listings.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState !== "ready") return;
    Promise.resolve().then(() => load(tab));
  }, [authState, tab]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Marketplace" />

      <div className="flex-1 max-w-md w-full mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex rounded-[var(--r-pill)] border border-[var(--border)] p-1">
            <button
              onClick={() => setTab("browse")}
              className={`rounded-[var(--r-pill)] px-4 py-1.5 text-xs font-bold ${
                tab === "browse" ? "bg-[var(--cyclo-teal)] text-white" : "text-[var(--text-2)]"
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setTab("mine")}
              className={`rounded-[var(--r-pill)] px-4 py-1.5 text-xs font-bold ${
                tab === "mine" ? "bg-[var(--cyclo-teal)] text-white" : "text-[var(--text-2)]"
              }`}
            >
              My Listings
            </button>
          </div>
          <Link href="/marketplace/new" className="rounded-full bg-[var(--cyclo-teal)] text-white text-xs font-bold px-4 py-2">
            + New
          </Link>
        </div>

        {state === "loading" && <LoadingState label="Loading listings…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={() => load(tab)} />}

        {state === "ready" && listings.length === 0 && (
          <EmptyState
            title={tab === "browse" ? "No listings yet" : "You haven't listed anything yet"}
            hint="Start by listing recyclable material to sell."
            action={
              <Link href="/marketplace/new" className="inline-block rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm px-5 py-2.5">
                List Material
              </Link>
            }
          />
        )}

        {state === "ready" && listings.length > 0 && (
          <div className="flex flex-col gap-2">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>

      {user && <BottomNav role={user.role} />}
    </main>
  );
}
