"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapPin, Scale, Recycle, Magnet, FileText, Package, Shirt, GlassWater, Cpu, Leaf, Trash2, type LucideIcon } from "lucide-react";
import { api, ApiError, CurrentUser, WasteListing, listingStatusLabel, formatUnitPrice, tokenStore } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { StatusBadge } from "@/components/StatusBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { FeaturedBadge } from "@/components/FeaturedBadge";
import { StarRatingDisplay } from "@/components/StarRating";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";

type Tab = "browse" | "mine";
type LoadState = "loading" | "ready" | "error";

const CATEGORIES = ["plastic", "paper", "cardboard", "textile", "glass", "metal", "e_waste", "organic", "other"];

// Mirrors home/page.tsx's CATEGORY_ICON — small, stable map duplicated locally rather
// than factored into a shared module for nine lookup entries.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  plastic: Recycle,
  metal: Magnet,
  paper: FileText,
  cardboard: Package,
  textile: Shirt,
  glass: GlassWater,
  e_waste: Cpu,
  organic: Leaf,
  other: Trash2,
};

function ListingCard({ listing }: { listing: WasteListing }) {
  const { t } = useLanguage();
  const photo = listing.photos?.[0];
  const CategoryIcon = CATEGORY_ICON[listing.material.category] ?? Trash2;
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="flex gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3"
    >
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[var(--r-sm)] bg-[var(--bg)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- may be a base64 data URL, not an optimizable remote asset
          <img src={photo} alt={listing.material.label} className="h-full w-full object-cover" />
        ) : (
          <CategoryIcon size={26} strokeWidth={1.5} className="text-[var(--text-2)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3 mb-1">
          <span className="text-sm font-extrabold">{t(listing.material.label)}</span>
          {formatUnitPrice(listing) && (
            <span className="text-sm font-extrabold text-[var(--cyclo-teal)] whitespace-nowrap">
              {formatUnitPrice(listing)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-2)] mb-2">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} /> {listing.location.region ?? listing.location.label}
          </span>
          <span className="inline-flex items-center gap-1">
            <Scale size={12} /> {listing.estimatedWeightKg} kg
          </span>
        </div>
        <div className="mb-2">
          <StarRatingDisplay average={listing.seller.rating?.average ?? 0} count={listing.seller.rating?.count ?? 0} seed={listing.seller.id} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={listing.status} />
          {listing.status === "ACTIVE" && listing.moderationStatus !== "APPROVED" && (
            <span className="inline-block rounded-[var(--r-pill)] bg-[#FFF3DC] text-[var(--warning)] px-2.5 py-1 text-[11px] font-bold">
              {listingStatusLabel(listing)}
            </span>
          )}
          <VerifiedBadge status={listing.seller.verificationStatus} />
          <FeaturedBadge featuredUntil={listing.seller.featuredUntil} />
        </div>
      </div>
    </Link>
  );
}

// Browsing the marketplace is public (§ landing/home redesign — a visitor can look
// without an account); only creating/managing listings and buying (contact seller)
// need one. So this checks for a session without ever redirecting an anonymous
// visitor away, unlike useCurrentUser().
function useOptionalCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    api
      .me()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) tokenStore.clear();
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, checked };
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={null}>
      <MarketplaceContent />
    </Suspense>
  );
}

function MarketplaceContent() {
  const { t } = useLanguage();
  const { user, checked } = useOptionalCurrentUser();
  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get("category") ?? "";
  const [tab, setTab] = useState<Tab>("browse");
  const [listings, setListings] = useState<WasteListing[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(categoryFromUrl);
  const [location, setLocation] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minQty, setMinQty] = useState("");
  const [showFilters, setShowFilters] = useState(!!categoryFromUrl);

  // A category tapped from the home page's "Browse by category" tiles arrives as
  // ?category=plastic — applied here so a link change is picked up even if this page
  // instance was already mounted (Next reuses the component across query-only navigations).
  useEffect(() => {
    if (categoryFromUrl) setCategory(categoryFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFromUrl]);

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
    if (!checked) return;
    if (tab === "mine" && !user) return;
    Promise.resolve().then(() => load(tab));
  }, [checked, user, tab]);

  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = listings.filter((l) => {
      if (q && !l.material.label.toLowerCase().includes(q) && !(l.description ?? "").toLowerCase().includes(q)) return false;
      if (category && l.material.category !== category) return false;
      if (location && !(l.location.region ?? l.location.label).toLowerCase().includes(location.toLowerCase())) return false;
      if (minPrice && (l.askingPrice == null || l.askingPrice < Number(minPrice))) return false;
      if (maxPrice && (l.askingPrice == null || l.askingPrice > Number(maxPrice))) return false;
      if (minQty && l.estimatedWeightKg < Number(minQty)) return false;
      return true;
    });
    // Listings with a real photo first, ones still showing the icon placeholder last —
    // same ordering as the home page's "Available materials near you" row.
    return filtered.sort((a, b) => Number(b.photos.length > 0) - Number(a.photos.length > 0));
  }, [listings, search, category, location, minPrice, maxPrice, minQty]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      {user ? (
        <AppHeader title="Marketplace" />
      ) : (
        <header className="sticky top-0 z-10 bg-[var(--chrome-bg)] border-b border-[var(--chrome-border)]">
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4 px-6 py-3 md:max-w-xl lg:max-w-3xl">
            <Link href="/" aria-label="CYCLO home">
              <Image src="/brand/cyclo-logo-light.png" alt="CYCLO" width={120} height={34} className="cyclo-header-logo-light h-[34px] w-auto" />
              <Image src="/brand/cyclo-logo-dark.png" alt="CYCLO" width={120} height={34} className="cyclo-header-logo-dark h-[34px] w-auto" />
            </Link>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <Link
                href={`/login?redirect=${encodeURIComponent("/marketplace")}`}
                className="rounded-full bg-[var(--cyclo-teal)] px-4 py-2 text-sm font-bold text-white"
              >
                {t("Log in")}
              </Link>
            </div>
          </div>
        </header>
      )}

      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex rounded-[var(--r-pill)] border border-[var(--border)] p-1">
            <button
              onClick={() => setTab("browse")}
              className={`rounded-[var(--r-pill)] px-4 py-1.5 text-xs font-bold ${
                tab === "browse" ? "bg-[var(--cyclo-teal)] text-white" : "text-[var(--text-on-bg-2)]"
              }`}
            >
              {t("Browse")}
            </button>
            {user ? (
              <button
                onClick={() => setTab("mine")}
                className={`rounded-[var(--r-pill)] px-4 py-1.5 text-xs font-bold ${
                  tab === "mine" ? "bg-[var(--cyclo-teal)] text-white" : "text-[var(--text-on-bg-2)]"
                }`}
              >
                {t("My Listings")}
              </button>
            ) : (
              <Link
                href={`/login?redirect=${encodeURIComponent("/marketplace")}`}
                className="rounded-[var(--r-pill)] px-4 py-1.5 text-xs font-bold text-[var(--text-on-bg-2)]"
              >
                {t("My Listings")}
              </Link>
            )}
          </div>
          <Link
            href={user ? "/marketplace/new" : `/login?redirect=${encodeURIComponent("/marketplace/new")}`}
            className="rounded-full bg-[var(--cyclo-teal)] text-white text-xs font-bold px-4 py-2"
          >
            {t("+ New")}
          </Link>
        </div>

        <Link href="/prices" className="inline-block text-xs font-bold text-[var(--cyclo-green)] mb-4">
          {t("View transparent reference prices →")}
        </Link>

        {tab === "browse" && (
          <div className="mb-4">
            <div className="flex gap-2 mb-2">
              <input
                placeholder={t("Search materials…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2.5 text-xs font-bold text-[var(--text-on-bg-2)]"
              >
                {showFilters ? t("Hide filters") : t("Filters")}
              </button>
            </div>

            {showFilters && (
              <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2 mb-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs bg-[var(--surface)]"
                >
                  <option value="">{t("All categories")}</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(c.replace(/_/g, " "))}
                    </option>
                  ))}
                </select>
                <input
                  placeholder={t("Location contains…")}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder={t("Min price")}
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="flex-1 rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder={t("Max price")}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="flex-1 rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder={t("Min qty")}
                    value={minQty}
                    onChange={(e) => setMinQty(e.target.value)}
                    className="flex-1 rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "mine" && !user && checked && (
          <EmptyState
            title={t("Log in to see your listings")}
            hint={t("Create a free account or log in to list and manage your own materials.")}
            action={
              <Link
                href={`/login?redirect=${encodeURIComponent("/marketplace/new")}`}
                className="inline-block rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm px-5 py-2.5"
              >
                {t("Log in / Sign up")}
              </Link>
            }
          />
        )}

        {(tab === "browse" || user) && state === "loading" && <LoadingState label={t("Loading listings…")} />}
        {(tab === "browse" || user) && state === "error" && (
          <ErrorState message={error ?? t("Something went wrong.")} onRetry={() => load(tab)} />
        )}

        {(tab === "browse" || user) && state === "ready" && listings.length === 0 && (
          <EmptyState
            title={tab === "browse" ? t("No listings yet") : t("You haven't listed anything yet")}
            hint={t("Start by listing recyclable material to sell.")}
            action={
              <Link
                href={user ? "/marketplace/new" : `/login?redirect=${encodeURIComponent("/marketplace/new")}`}
                className="inline-block rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm px-5 py-2.5"
              >
                {t("List Material")}
              </Link>
            }
          />
        )}

        {(tab === "browse" || user) && state === "ready" && listings.length > 0 && filteredListings.length === 0 && (
          <EmptyState title={t("No listings match your filters")} hint={t("Try widening your search.")} />
        )}

        {(tab === "browse" || user) && state === "ready" && filteredListings.length > 0 && (
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
