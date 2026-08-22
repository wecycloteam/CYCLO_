// §26 — only ever renders from the account's actual verificationStatus from the API,
// never a client-side assumption. Silent (renders nothing) for every non-verified state
// so an unverified/pending/rejected/suspended account never looks verified by omission.
export function VerifiedBadge({ status }: { status: string }) {
  if (status !== "verified") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--r-pill)] bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--success)]">
      ✓ Verified
    </span>
  );
}
