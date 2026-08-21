"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

// §9 — producer nav (household/business). Scan links to a "coming in Phase 3" page
// rather than being omitted, so the nav shape matches the spec even though the AI
// classifier isn't built yet — nothing about the link itself claims it works.
const PRODUCER_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: "🏠" },
  { href: "/marketplace", label: "Marketplace", icon: "🛒" },
  { href: "/scan", label: "Scan", icon: "📷" },
  { href: "/activity", label: "Activity", icon: "🚚" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

// Collector nav mirrors the prototype's Jobs/Active/Profile shape (index.html
// #view-collector) minus Earnings — there's no wallet/payment data yet (Phase 5),
// so it isn't shown rather than shown with fabricated numbers.
const COLLECTOR_ITEMS: NavItem[] = [
  { href: "/jobs", label: "Jobs", icon: "📋" },
  { href: "/activity", label: "Active", icon: "🧭" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

// Roles without a built dashboard yet (business dashboard, recycler, authority, admin —
// Phases 6, 7, 9, 8) fall back to this rather than a fabricated set of tabs.
const MINIMAL_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: "🏠" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

function itemsForRole(role: string): NavItem[] {
  if (role === "household") return PRODUCER_ITEMS;
  if (role === "collector") return COLLECTOR_ITEMS;
  return MINIMAL_ITEMS;
}

export function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const items = itemsForRole(role);

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-[var(--border)] bg-[var(--surface)]">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${
              active ? "text-[var(--cyclo-teal)]" : "text-[var(--text-3)]"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
