"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { api } from "@/lib/api";
import {
  Home,
  Camera,
  Truck,
  Compass,
  LayoutDashboard,
  Tag,
  Shield,
  Wallet,
  MessageCircle,
  ShoppingCart,
  ShoppingBag,
  Flag,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Profile is deliberately not a tab here — AppHeader now shows a profile avatar in the
// top-right on every page that has one, so a second, identical bottom-nav entry was pure
// duplication (per feedback). Marketplace is also dropped from this seller-side nav: the
// household/business home page's own "Available materials near you → See all" link
// already goes straight to /marketplace, so a dedicated tab for it here was redundant too.
const PRODUCER_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/scan", label: "List Waste", icon: Camera },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/activity", label: "Activity", icon: Truck },
];

// Buyer (collector-mode) nav — Marketplace stays here since, unlike the seller side,
// there's no other route to it for a buyer (their home page has no equivalent "see all"
// link); buying happens by browsing it directly and using Buy Now/Add to Cart.
const COLLECTOR_ITEMS: NavItem[] = [
  { href: "/marketplace", label: "Marketplace", icon: ShoppingCart },
  { href: "/cart", label: "Cart", icon: ShoppingBag },
  { href: "/activity", label: "Activity", icon: Compass },
  { href: "/chat", label: "Chat", icon: MessageCircle },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/listings", label: "Listings", icon: Tag },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/users", label: "Users", icon: Shield },
  { href: "/admin/pricing", label: "Pricing", icon: Wallet },
];

// Roles without a built dashboard yet (business dashboard, recycler, authority —
// Phases 6, 7, 9) fall back to this rather than a fabricated set of tabs.
const MINIMAL_ITEMS: NavItem[] = [{ href: "/home", label: "Home", icon: Home }];

function itemsForRole(role: string): NavItem[] {
  if (role === "household") return PRODUCER_ITEMS;
  if (role === "collector") return COLLECTOR_ITEMS;
  if (role === "admin") return ADMIN_ITEMS;
  return MINIMAL_ITEMS;
}

export function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const items = itemsForRole(role);
  const [cartCount, setCartCount] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);

  useEffect(() => {
    if (role !== "collector") return;
    api.myCart().then((c) => setCartCount(c.items.length)).catch(() => undefined);
    // Re-checks whenever the buyer lands back on this nav (e.g. after adding an item and
    // navigating) rather than polling continuously for a count that rarely changes.
  }, [role, pathname]);

  useEffect(() => {
    if (role !== "admin") return;
    // The bottom-nav badge is the "notification" surface for new suspicious-activity
    // reports — no push/email infra exists, so a live count here (re-checked on every
    // admin-side navigation) is the honest equivalent.
    api.adminListReports("UNDER_REVIEW").then((r) => setPendingReportsCount(r.length)).catch(() => undefined);
  }, [role, pathname]);

  return (
    <nav className="sticky bottom-0 z-10 border-t border-[var(--chrome-border)] bg-[var(--chrome-bg)]">
      <div className="mx-auto flex w-full max-w-md md:max-w-xl lg:max-w-3xl">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${
                active ? "text-[var(--cyclo-green)]" : "text-[var(--chrome-text-muted)]"
              }`}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={2} />
                {item.href === "/cart" && cartCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--critical)] px-1 text-[9px] font-extrabold text-white">
                    {cartCount}
                  </span>
                )}
                {item.href === "/admin/reports" && pendingReportsCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--critical)] px-1 text-[9px] font-extrabold text-white">
                    {pendingReportsCount}
                  </span>
                )}
              </span>
              {t(item.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
