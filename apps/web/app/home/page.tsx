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
  Circle,
  Shirt,
  Trash2,
  MapPin,
  Bell,
  Search,
  Camera,
  Tag,
  BookOpen,
  Scale,
  ShoppingBag,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ImpactStats, Location, Order, WasteListing, formatUnitPrice, materialShortName } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { AssistantChat } from "@/components/AssistantChat";
import { StatusBadge } from "@/components/StatusBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n";
import { LoadingState, ErrorState } from "@/components/AsyncState";

const CATEGORY_TILES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "plastic", label: "Plastic", icon: Recycle },
  { key: "paper_cardboard", label: "Paper & cardboard", icon: FileText },
  { key: "metal", label: "Metal", icon: Magnet },
  { key: "glass", label: "Glass", icon: GlassWater },
  { key: "e_waste", label: "E-waste", icon: Cpu },
  { key: "textile", label: "Textile", icon: Shirt },
  { key: "rubber", label: "Rubber", icon: Circle },
];

const CATEGORY_ICON: Record<string, LucideIcon> = {
  plastic: Recycle,
  paper_cardboard: FileText,
  metal: Magnet,
  glass: GlassWater,
  e_waste: Cpu,
  textile: Shirt,
  rubber: Circle,
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
  const { t } = useLanguage();
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
        {formatUnitPrice(listing) && (
          <span className="absolute right-2 top-2 rounded-full bg-[var(--cyclo-teal-dark)] px-2 py-0.5 text-[10px] font-extrabold text-white">
            {formatUnitPrice(listing)}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-xs font-extrabold text-[var(--text-1)]">{t(materialShortName(listing.material))}</div>
        <div className="mt-0.5 truncate text-[10px] font-bold text-[var(--text-2)]">{listing.seller.name}</div>
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
  const { t } = useLanguage();
  const { state, user, error, retry } = useCurrentUser();
  const [recentListings, setRecentListings] = useState<WasteListing[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [impact, setImpact] = useState<ImpactStats | null>(null);
  const [nearbyListings, setNearbyListings] = useState<WasteListing[]>([]);
  const [nearbyState, setNearbyState] = useState<"loading" | "ready" | "error">("loading");
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (state !== "ready" || !user) return;
    api.unreadNotificationCount().then((res) => setUnreadCount(res.count)).catch(() => undefined);
  }, [state, user]);

  useEffect(() => {
    if (state !== "ready" || !user) return;
    api.myListings().then(setRecentListings).catch(() => undefined);
    api.myOrders().then(setRecentOrders).catch(() => undefined);
    if (user.role !== "collector") {
      api.myLocations().then(setLocations).catch(() => undefined);
      setNearbyState("loading");
      api
        .browseListings()
        .then((res) => {
          // Listings with a real photo feel more like the landing page's product
          // grid — shown first; ones with no photo yet (icon placeholder) sink to
          // the end rather than being interleaved.
          const sorted = [...res].sort((a, b) => Number(b.photos.length > 0) - Number(a.photos.length > 0));
          setNearbyListings(sorted.slice(0, 8));
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
      {state === "ready" && user ? (
        <header className="sticky top-0 z-10 border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)]">
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 py-3 md:max-w-xl lg:max-w-3xl">
            <div className="flex items-center gap-2">
              <Image
                src="/brand/cyclo-logo-light.png"
                alt="CYCLO"
                width={92}
                height={26}
                className="cyclo-header-logo-light h-[26px] w-auto"
              />
              <Image
                src="/brand/cyclo-logo-dark.png"
                alt="CYCLO"
                width={92}
                height={26}
                className="cyclo-header-logo-dark h-[26px] w-auto"
              />
              <Link href="/profile" className="hidden items-center gap-1 rounded-full bg-[var(--cyclo-teal)] px-2.5 py-1 text-[11px] font-bold text-white sm:flex">
                <MapPin size={12} /> {locationLabel}
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="relative grid h-9 w-9 place-items-center rounded-full border border-[var(--chrome-border)] text-[var(--chrome-text)]"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--critical)] px-1 text-[9px] font-extrabold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/profile"
                aria-label="Your profile"
                className="grid h-9 w-9 place-items-center rounded-full bg-[var(--cyclo-teal)] text-sm font-extrabold text-white"
              >
                {user.name.trim().charAt(0).toUpperCase() || "?"}
              </Link>
            </div>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-10 bg-[var(--chrome-bg)] border-b border-[var(--chrome-border)]">
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4 px-6 py-3 md:max-w-xl lg:max-w-3xl">
            <Image
              src="/brand/cyclo-logo-light.png"
              alt="CYCLO"
              width={140}
              height={40}
              className="cyclo-header-logo-light h-[42px] w-auto"
            />
            <Image
              src="/brand/cyclo-logo-dark.png"
              alt="CYCLO"
              width={140}
              height={40}
              className="cyclo-header-logo-dark h-[42px] w-auto"
            />
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>
      )}

      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-5 py-6">
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
                  placeholder={t("Search recyclable materials…")}
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
                <div className="text-xs font-bold uppercase tracking-wide text-[#B9D6D1] mb-1">{t("Turn waste into value")}</div>
                <div className="text-xl font-extrabold leading-snug">{t("Scan waste,")}
                  <br />
                  {t("get an instant price →")}
                </div>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--cyclo-green)] px-4 py-2 text-xs font-extrabold text-[#0E2A1F]">
                  <Camera size={14} /> {t("AI Scan Waste")}
                </span>
              </div>
            </Link>

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[var(--text-on-bg)]">{t("Browse by category")}</h3>
            </div>
            <div className="mb-6 grid grid-cols-3 gap-2.5">
              {CATEGORY_TILES.map((c) => (
                <Link
                  key={c.key}
                  href={`/marketplace?category=${c.key}`}
                  className="flex flex-col items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] py-4 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <c.icon size={22} strokeWidth={1.75} className="text-[var(--cyclo-teal)]" />
                  <span className="text-[11px] font-bold text-[var(--text-1)]">{t(c.label)}</span>
                </Link>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[var(--text-on-bg)]">{t("Available materials near you")}</h3>
              <Link href="/marketplace" className="text-xs font-bold text-[var(--cyclo-green)]">
                {t("See all")}
              </Link>
            </div>
            <div className="mb-6 -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
              {nearbyState === "loading" && <p className="text-xs text-[var(--text-2)] py-6">{t("Loading listings…")}</p>}
              {nearbyState === "error" && <p className="text-xs text-[var(--text-2)] py-6">{t("Couldn't load nearby listings right now.")}</p>}
              {nearbyState === "ready" && nearbyListings.length === 0 && (
                <p className="text-xs text-[var(--text-2)] py-6">{t("No listings yet — be the first to list something.")}</p>
              )}
              {nearbyState === "ready" && nearbyListings.map((l) => <ListingProductCard key={l.id} listing={l} />)}
            </div>

            <div className="mb-3">
              <h3 className="text-sm font-extrabold text-[var(--text-on-bg)] mb-3">{t("Quick actions")}</h3>
              <div className="grid grid-cols-4 gap-2.5">
                <QuickAction href="/marketplace/new" icon={Tag} label={t("Sell Waste")} />
                <QuickAction href="/scan" icon={Camera} label={t("List Waste")} />
                <QuickAction href="/orders" icon={ShoppingBag} label={t("Orders")} />
                <QuickAction href="/chat" icon={MessageCircle} label={t("Chat")} />
                <QuickAction href="/learn" icon={BookOpen} label={t("Learn")} />
              </div>
            </div>
          </>
        )}

        {state === "ready" && user && user.role === "collector" && (
          <>
            <div className="mb-6">
              <div className="text-sm text-[var(--text-on-bg-2)]">{t("Good to see you")}</div>
              <div className="text-xl font-extrabold text-[var(--text-on-bg)]">{user.name}</div>
            </div>
            <Link
              href="/marketplace"
              className="block rounded-[var(--r-lg)] p-5 mb-8 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, var(--cyclo-teal), #1B3E41)" }}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-[#B9D6D1] mb-1">{t("Buyer")}</div>
              <div className="text-lg font-extrabold">{t("Browse the marketplace →")}</div>
            </Link>
          </>
        )}

        {state === "ready" && user && (
          <>
            {impact && user.role !== "collector" && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                <StatTile label={t("Waste recycled")} value={`${impact.asSeller.wasteRecycledKg} kg`} />
                <StatTile label={t("Est. earnings")} value={`TZS ${Math.round(impact.asSeller.estimatedEarnings).toLocaleString()}`} />
                <StatTile label={t("Est. CO₂ avoided")} value={`${impact.asSeller.co2AvoidedKg} kg`} />
              </div>
            )}
            {impact && user.role === "collector" && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <StatTile label={t("Pickups completed")} value={`${impact.asCollector.completedCount}`} />
                <StatTile label={t("Weight collected")} value={`${impact.asCollector.collectedWeightKg} kg`} />
              </div>
            )}
            {impact && (
              <Link href="/impact" className="mb-8 inline-block text-xs font-bold text-[var(--cyclo-green)]">
                {t("See full impact & achievements →")}
              </Link>
            )}

            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-[var(--text-on-bg)]">{t("Your recent activity")}</h3>
              <Link href="/activity" className="text-xs font-bold text-[var(--cyclo-green)]">
                {t("See all")}
              </Link>
            </div>

            {recentOrders.length === 0 && recentListings.length === 0 && (
              <p className="text-xs text-[var(--text-on-bg-2)]">{t("Nothing here yet — get started above.")}</p>
            )}

            <div className="flex flex-col gap-2">
              {recentOrders.slice(0, 3).map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-bold">{t(o.listing.material.label)}</div>
                    <div className="text-xs text-[var(--text-2)]">TZS {o.agreedPrice.toLocaleString()}</div>
                  </div>
                  <StatusBadge status={o.paymentStatus} />
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
                      <div className="text-sm font-bold">{t(materialShortName(l.material))}</div>
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
