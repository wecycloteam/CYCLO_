// Shared loading/error/empty presentation so every list/detail page implements the same
// three states the same way (§46/§47) instead of reinventing them per page.

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <p className="text-sm text-[var(--text-2)] py-8 text-center">{label}</p>;
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
      <p className="text-sm font-bold text-[var(--text-1)] mb-1">{title}</p>
      {hint && <p className="text-xs text-[var(--text-2)] mb-4">{hint}</p>}
      {action}
    </div>
  );
}
