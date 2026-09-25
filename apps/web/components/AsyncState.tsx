// Shared loading/error/empty presentation so every list/detail page implements the same
// three states the same way (§46/§47) instead of reinventing them per page.
//
// LoadingState and EmptyState are always used bare, directly on the page background
// (--bg) — neither renders its own solid surface fill — so they use --text-on-bg*, not
// --text-1/2 (which assume a light --surface card behind them). ErrorState does have its
// own bg-[var(--surface)] card, so its text stays on --text-2 as before.

import { Recycle } from "lucide-react";

// A small pulsing CYCLO mark instead of a spinner or bare "Loading…" text — same branded
// feel as PageTransitionOverlay's route-change flash, just sized for an inline data-fetch
// wait rather than a full-screen transition. currentColor via the teal token means this
// looks right in both themes without needing separate light/dark image assets. `label`
// still exists for a11y (announced to screen readers) even though it's no longer shown
// as visible text.
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10" role="status" aria-label={label}>
      <Recycle size={32} strokeWidth={1.75} className="animate-pulse text-[var(--cyclo-teal)]" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm text-[var(--text-2)] mb-4">{message}</p>
      <button onClick={onRetry} className="rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm px-5 py-2.5">
        Retry
      </button>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--border)] p-8 text-center">
      <p className="text-sm font-bold text-[var(--text-on-bg)] mb-1">{title}</p>
      {hint && <p className="text-xs text-[var(--text-on-bg-2)] mb-4">{hint}</p>}
      {action}
    </div>
  );
}
