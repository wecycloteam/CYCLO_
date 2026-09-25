import { Sparkles } from "lucide-react";

// Only renders while a real, active "Featured Seller Placement" CC redemption is in
// effect (featuredUntil in the future) — never a decorative default.
export function FeaturedBadge({ featuredUntil }: { featuredUntil?: string | null }) {
  if (!featuredUntil || new Date(featuredUntil).getTime() <= Date.now()) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--r-pill)] bg-[var(--cyclo-green)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--cyclo-green-deep)]">
      <Sparkles size={12} strokeWidth={2.5} /> Featured
    </span>
  );
}
