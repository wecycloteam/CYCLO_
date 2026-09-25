"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import {
  Home,
  ShoppingCart,
  Camera,
  Truck,
  User,
  Compass,
  LayoutDashboard,
  Tag,
  Shield,
  Wallet,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// §9 — producer nav (household/business). Scan links to a "coming in Phase 3" page
// rather than being omitted, so the nav shape matches the spec even though the AI
// classifier isn't built yet — nothing about the link itself claims it works.
const PRODUCER_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingCart },
  { href: "/scan", label: "Scan", icon: Camera },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/activity", label: "Activity", icon: Truck },
  { href: "/profile", label: "Profile", icon: User },
];

// Buyer (collector-mode) nav — buying now happens by browsing the marketplace and using
// Buy Now directly, not by accepting open collection jobs, so Marketplace replaces the
// old Jobs tab here.
const COLLECTOR_ITEMS: NavItem[] = [
  { href: "/marketplace", label: "Marketplace", icon: ShoppingCart },
  { href: "/activity", label: "Active", icon: Compass },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/listings", label: "Listings", icon: Tag },
  { href: "/admin/users", label: "Users", icon: Shield },
  { href: "/admin/pricing", label: "Pricing", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
];

// Roles without a built dashboard yet (business dashboard, recycler, authority —
// Phases 6, 7, 9) fall back to this rather than a fabricated set of tabs.
const MINIMAL_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/profile", label: "Profile", icon: User },
];

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

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-[var(--chrome-border)] bg-[var(--chrome-bg)]">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${
              active ? "text-[var(--cyclo-green)]" : "text-[var(--chrome-text-muted)]"
            }`}
          >
            <Icon size={20} strokeWidth={2} />
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}
