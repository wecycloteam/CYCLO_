"use client";

import { Star } from "lucide-react";

export function StarRatingDisplay({ average, count, size = 14 }: { average: number; count: number; size?: number }) {
  if (count === 0) {
    return <span className="text-xs text-[var(--text-3)]">No ratings yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Star size={size} className="fill-[var(--warning)] text-[var(--warning)]" />
      <span className="text-xs font-bold text-[var(--text-1)]">{average.toFixed(1)}</span>
      <span className="text-xs text-[var(--text-3)]">({count})</span>
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
