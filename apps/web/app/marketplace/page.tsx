"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, WasteListing, listingStatusLabel } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { StatusBadge } from "@/components/StatusBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";

type Tab = "browse" | "mine";
type LoadState = "loading" | "ready" | "error";

const CATEGORIES = ["plastic", "paper", "cardboard", "glass", "metal", "e_waste", "organic", "other"];

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
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={listing.status} />
        {listing.status === "ACTIVE" && listing.moderationStatus !== "APPROVED" && (
          <span className="inline-block rounded-[var(--r-pill)] bg-[#FFF3DC] text-[var(--warning)] px-2.5 py-1 text-[11px] font-bold">
            {listingStatusLabel(listing)}
          </span>
        )}
        <VerifiedBadge status={listing.seller.verificationStatus} />
      </div>
    </Link>
  );
}

export default function MarketplacePage() {
  const { state: authState, user } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("browse");
  const [listings, setListings] = useState<WasteListing[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minQty, setMinQty] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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

  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) => {
      if (q && !l.material.label.toLowerCase().includes(q) && !(l.description ?? "").toLowerCase().includes(q)) return false;
      if (category && l.material.category !== category) return false;
      if (location && !(l.location.region ?? l.location.label).toLowerCase().includes(location.toLowerCase())) return false;
      if (minPrice && (l.askingPrice == null || l.askingPrice < Number(minPrice))) return false;
      if (maxPrice && (l.askingPrice == null || l.askingPrice > Number(maxPrice))) return false;
      if (minQty && l.estimatedWeightKg < Number(minQty)) return false;
      return true;
    });
  }, [listings, search, category, location, minPrice, maxPrice, minQty]);

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

        <Link href="/prices" className="inline-block text-xs font-bold text-[var(--cyclo-teal)] mb-4">
          View transparent reference prices →
        </Link>

        {tab === "browse" && (
          <div className="mb-4">
            <div className="flex gap-2 mb-2">
              <input
                placeholder="Search materials…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2.5 text-xs font-bold text-[var(--text-2)]"
              >
                {showFilters ? "Hide filters" : "Filters"}
              </button>
            </div>

            {showFilters && (
              <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2 mb-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs bg-[var(--surface)]"
                >
                  <option value="">All categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Location contains…"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Min price"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="flex-1 rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Max price"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="flex-1 rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Min qty"
                    value={minQty}
                    onChange={(e) => setMinQty(e.target.value)}
                    className="flex-1 rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}

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

        {state === "ready" && listings.length > 0 && filteredListings.length === 0 && (
          <EmptyState title="No listings match your filters" hint="Try widening your search." />
        )}

        {state === "ready" && filteredListings.length > 0 && (
          <div className="flex flex-col gap-2">
            {filteredListings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>

      {user && <BottomNav role={user.role} />}
    </main>
  );
}
