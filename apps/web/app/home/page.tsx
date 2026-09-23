"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Recycle,
  Magnet,
  FileText,
  GlassWater,
  Cpu,
  Leaf,
  Package,
  Trash2,
  MapPin,
  Bell,
  Search,
  Camera,
  Tag,
  Truck,
  BookOpen,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ImpactStats, Location, PickupRequest, WasteListing } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { AssistantChat } from "@/components/AssistantChat";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState, ErrorState } from "@/components/AsyncState";

const CATEGORY_TILES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "plastic", label: "Plastic", icon: Recycle },
  { key: "metal", label: "Metal", icon: Magnet },
  { key: "paper", label: "Paper", icon: FileText },
  { key: "glass", label: "Glass", icon: GlassWater },
  { key: "e_waste", label: "Electronics", icon: Cpu },
  { key: "organic", label: "Organic", icon: Leaf },
];

const CATEGORY_ICON: Record<string, LucideIcon> = {
  plastic: Recycle,
  metal: Magnet,
  paper: FileText,
  cardboard: Package,
  glass: GlassWater,
  e_waste: Cpu,
  organic: Leaf,
  other: Trash2,
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="text-base font-extrabold">{value}</div>
      <div className="text-[10px] text-[var(--text-2)]">{label}</div>
    </div>
  );
}

function ListingProductCard({ listing }: { listing: WasteListing }) {
  const photo = listing.photos?.[0];
  const CategoryIcon = CATEGORY_ICON[listing.material.category] ?? Trash2;
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="flex w-40 shrink-0 flex-col overflow-hidden rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative flex h-28 w-full items-center justify-center overflow-hidden bg-[var(--bg)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={listing.material.label} className="h-full w-full object-cover" />
        ) : (
          <CategoryIcon size={36} strokeWidth={1.5} className="text-[var(--text-2)]" />
        )}
        {listing.askingPrice != null && (
          <span className="absolute right-2 top-2 rounded-full bg-[var(--cyclo-teal-dark)] px-2 py-0.5 text-[10px] font-extrabold text-white">
            TZS {listing.askingPrice.toLocaleString()}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-xs font-extrabold text-[var(--text-1)]">{listing.material.label}</div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-2)]">
          <Scale size={11} /> {listing.estimatedWeightKg} kg
        </div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-[var(--text-2)]">
          <MapPin size={11} className="shrink-0" /> {listing.location.region ?? listing.location.label}
        </div>
      </div>
    </Link>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-4 text-center transition hover:-translate-y-0.5 hover:shadow-sm"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--cyclo-teal)]/10 text-[var(--cyclo-teal)]">
        <Icon size={18} />
      </span>
      <span className="text-[11px] font-bold leading-tight text-[var(--text-1)]">{label}</span>
    </Link>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { state, user, error, retry } = useCurrentUser();
  const [recentListings, setRecentListings] = useState<WasteListing[]>([]);
  const [recentPickups, setRecentPickups] = useState<PickupRequest[]>([]);
  const [impact, setImpact] = useState<ImpactStats | null>(null);
  const [nearbyListings, setNearbyListings] = useState<WasteListing[]>([]);
  const [nearbyState, setNearbyState] = useState<"loading" | "ready" | "error">("loading");
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (state !== "ready" || !user) return;
    api.myListings().then(setRecentListings).catch(() => undefined);
    if (user.role === "collector") {
      api.assignedPickupJobs().then(setRecentPickups).catch(() => undefined);
    } else {
      api.myPickupRequests().then(setRecentPickups).catch(() => undefined);
      api.myLocations().then(setLocations).catch(() => undefined);
      setNearbyState("loading");
      api
        .browseListings()
        .then((res) => {
          setNearbyListings(res.slice(0, 8));
          setNearbyState("ready");
        })
        .catch(() => setNearbyState("error"));
    }
    api.myImpact().then(setImpact).catch(() => undefined);
  }, [state, user]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push("/marketplace");
  }

  const locationLabel = locations[0]?.region ?? locations[0]?.label ?? "Add your location";

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      {state === "ready" && user && user.role !== "collector" ? (
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Image src="/brand/cyclo-logo-light.png" alt="CYCLO" width={92} height={26} className="h-[26px] w-auto" />
            <Link href="/profile" className="hidden items-center gap-1 rounded-full bg-[var(--bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-2)] sm:flex">
              <MapPin size={12} /> {locationLabel}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/activity"
              aria-label="Notifications and activity"
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] text-[var(--text-1)]"
            >
              <Bell size={18} />
            </Link>
            <Link
              href="/profile"
              aria-label="Your profile"
              className="grid h-9 w-9 place-items-center rounded-full bg-[var(--cyclo-teal)] text-sm font-extrabold text-white"
            >
              {user.name.trim().charAt(0).toUpperCase() || "?"}
            </Link>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
          <Image src="/brand/cyclo-logo-light.png" alt="CYCLO" width={140} height={40} className="h-[42px] w-auto" />
        </header>
      )}

      <div className="flex-1 max-w-md w-full mx-auto px-5 py-6">
        {state === "loading" && <LoadingState label="Loading your profile…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={retry} />}

        {state === "ready" && user && user.role !== "collector" && (
          <>
            <form onSubmit={handleSearch} className="mb-5">
              <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm">
                <Search size={16} className="text-[var(--text-2)]" />
                <input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search recyclable materials…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-3)]"
                />
              </div>
            </form>

            <Link
              href="/scan"
              className="relative mb-5 block overflow-hidden rounded-[var(--r-lg)] p-6 text-white"
              style={{ background: "linear-gradient(135deg, var(--cyclo-teal), #1B3E41)" }}
            >
              <div
                className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(72,245,59,0.35), transparent 70%)" }}
              />
              <div className="relative">
                <div className="text-xs font-bold uppercase tracking-wide text-[#B9D6D1] mb-1">Turn waste into value</div>
                <div className="text-xl font-extrabold leading-snug">Scan waste,
                  <br />
                  get an instant price →
                </div>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--cyclo-green)] px-4 py-2 text-xs font-extrabold text-[#0E2A1F]">
                  <Camera size={14} /> AI Scan Waste
                </span>
              </div>
            </Link>

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Browse by category</h3>
            </div>
            <div className="mb-6 grid grid-cols-3 gap-2.5">
              {CATEGORY_TILES.map((c) => (
                <Link
                  key={c.key}
                  href="/marketplace"
                  className="flex flex-col items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] py-4 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <c.icon size={22} strokeWidth={1.75} className="text-[var(--cyclo-teal)]" />
                  <span className="text-[11px] font-bold text-[var(--text-1)]">{c.label}</span>
                </Link>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Available materials near you</h3>
              <Link href="/marketplace" className="text-xs font-bold text-[var(--cyclo-teal)]">
                See all
              </Link>
            </div>
            <div className="mb-6 -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
              {nearbyState === "loading" && <p className="text-xs text-[var(--text-2)] py-6">Loading listings…</p>}
              {nearbyState === "error" && <p className="text-xs text-[var(--text-2)] py-6">Couldn&rsquo;t load nearby listings right now.</p>}
              {nearbyState === "ready" && nearbyListings.length === 0 && (
                <p className="text-xs text-[var(--text-2)] py-6">No listings yet — be the first to list something.</p>
              )}
              {nearbyState === "ready" && nearbyListings.map((l) => <ListingProductCard key={l.id} listing={l} />)}
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Nearby collectors &amp; recycling centers</h3>
            </div>
            <div className="mb-6 rounded-[var(--r-md)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-center">
              <p className="text-sm font-bold text-[var(--text-1)] mb-1">Coming soon</p>
              <p className="text-xs text-[var(--text-2)]">
                We&rsquo;re building a live map of verified collectors and recycling centers near you.
              </p>
            </div>

            <div className="mb-3">
              <h3 className="text-sm font-extrabold mb-3">Quick actions</h3>
              <div className="grid grid-cols-4 gap-2.5">
                <QuickAction href="/marketplace/new" icon={Tag} label="Sell Waste" />
                <QuickAction href="/activity/new" icon={Truck} label="Request Pickup" />
                <QuickAction href="/scan" icon={Camera} label="Scan" />
                <QuickAction href="/prices" icon={BookOpen} label="Learn" />
              </div>
            </div>
          </>
        )}

        {state === "ready" && user && user.role === "collector" && (
          <>
            <div className="mb-6">
              <div className="text-sm text-[var(--text-2)]">Good to see you</div>
              <div className="text-xl font-extrabold">{user.name}</div>
            </div>
            <Link
              href="/jobs"
              className="block rounded-[var(--r-lg)] p-5 mb-8 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, var(--cyclo-teal), #1B3E41)" }}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-[#B9D6D1] mb-1">Collector</div>
              <div className="text-lg font-extrabold">Browse open jobs →</div>
            </Link>
          </>
        )}

        {state === "ready" && user && (
          <>
            {impact && user.role !== "collector" && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                <StatTile label="Waste recycled" value={`${impact.asSeller.wasteRecycledKg} kg`} />
                <StatTile label="Est. earnings" value={`TZS ${Math.round(impact.asSeller.estimatedEarnings).toLocaleString()}`} />
                <StatTile label="Est. CO₂ avoided" value={`${impact.asSeller.co2AvoidedKg} kg`} />
              </div>
            )}
            {impact && user.role === "collector" && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <StatTile label="Pickups completed" value={`${impact.asCollector.completedCount}`} />
                <StatTile label="Weight collected" value={`${impact.asCollector.collectedWeightKg} kg`} />
              </div>
            )}
            {impact && (
              <Link href="/impact" className="mb-8 inline-block text-xs font-bold text-[var(--cyclo-teal)]">
                See full impact & achievements →
              </Link>
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

      {user && <AssistantChat />}
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
