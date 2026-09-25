const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-[var(--surface-2)] text-[var(--text-2)]",
  ACTIVE: "bg-[#E4F7E2] text-[var(--success)]",
  MATCHING: "bg-[#FFF3DC] text-[var(--warning)]",
  RESERVED: "bg-[#FFF3DC] text-[var(--warning)]",
  ASSIGNED: "bg-[#FFF3DC] text-[var(--warning)]",
  ACCEPTED: "bg-[#E4F7E2] text-[var(--success)]",
  EN_ROUTE: "bg-[#E4F7E2] text-[var(--success)]",
  ARRIVED: "bg-[#E4F7E2] text-[var(--success)]",
  COLLECTING: "bg-[#E4F7E2] text-[var(--success)]",
  WEIGHED: "bg-[#E4F7E2] text-[var(--success)]",
  SOLD: "bg-[#E4F7E2] text-[var(--success)]",
  COMPLETED: "bg-[#E4F7E2] text-[var(--success)]",
  COLLECTED: "bg-[#E4F7E2] text-[var(--success)]",
  CANCELLED: "bg-[var(--surface-2)] text-[var(--text-3)]",
  EXPIRED: "bg-[var(--surface-2)] text-[var(--text-3)]",
  DISPUTED: "bg-[#FCE3DE] text-[var(--critical)]",
  PENDING: "bg-[#FFF3DC] text-[var(--warning)]",
  AWAITING_CONFIRMATION: "bg-[#E4EEFC] text-[var(--cyclo-teal)]",
  PAID: "bg-[#E4F7E2] text-[var(--success)]",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-[var(--surface-2)] text-[var(--text-2)]";
  return (
    <span className={`inline-block rounded-[var(--r-pill)] px-2.5 py-1 text-[11px] font-bold ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
