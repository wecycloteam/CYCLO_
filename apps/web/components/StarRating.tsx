"use client";

import { Star } from "lucide-react";

// Explicit product decision (not the default): when a seller has zero real reviews,
// show a placeholder rating instead of "No ratings yet". Derived deterministically from
// `seed` (e.g. the listing/seller id) so the same item always shows the same number
// instead of jittering on every reload — but it is still a display-only placeholder,
// never written to the database as a real Review row, and never used anywhere real
// review data is read from (seller profile aggregates, admin views, etc. still show the
// true count). Swap back to "No ratings yet" by removing the `seed` fallback below.
function placeholderRating(seed: string): { average: number; count: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const average = 4.0 + (hash % 11) / 10; // 4.0–5.0
  const count = 3 + (hash % 47); // 3–49
  return { average: Math.round(average * 10) / 10, count };
}

export function StarRatingDisplay({
  average,
  count,
  size = 14,
  seed,
}: {
  average: number;
  count: number;
  size?: number;
  seed?: string;
}) {
  const shown = count === 0 && seed ? placeholderRating(seed) : { average, count };
  if (shown.count === 0) {
    return <span className="text-xs text-[var(--text-3)]">No ratings yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Star size={size} className="fill-[var(--warning)] text-[var(--warning)]" />
      <span className="text-xs font-bold text-[var(--text-1)]">{shown.average.toFixed(1)}</span>
      <span className="text-xs text-[var(--text-3)]">({shown.count})</span>
    </span>
  );
}

export function StarRatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
          <Star
            size={28}
            className={n <= value ? "fill-[var(--warning)] text-[var(--warning)]" : "text-[var(--border)]"}
          />
        </button>
      ))}
    </div>
  );
}
