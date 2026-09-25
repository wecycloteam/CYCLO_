"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Order } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";

// Payment progress is the real, honest signal of "how is this order coming along" this
// app currently has — there's no separate delivery/transport-logistics step built for the
// Order pipeline (the older PickupRequest/WasteEvent transport timeline belongs to the
// now-retired seller-initiated Jobs flow, kept but no longer linked from here). AWAITING_
// CONFIRMATION is the closest thing to "in transit": the buyer has paid and is waiting on
// the seller to confirm receipt and hand over the material.
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting your payment",
  AWAITING_CONFIRMATION: "Payment sent — awaiting seller confirmation",
  PAID: "Paid — collect from the seller",
  CANCELLED: "Cancelled",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-[#FFF3DC] text-[var(--warning)]",
  AWAITING_CONFIRMATION: "bg-[#E4EEFC] text-[var(--cyclo-teal)]",
  PAID: "bg-[#E4F7E2] text-[var(--success)]",
  CANCELLED: "bg-[#FCE3DE] text-[var(--critical)]",
};

function OrderCard({ order, isBuyer }: { order: Order; isBuyer: boolean }) {
  const { t } = useLanguage();
  return (
    <Link href={`/orders/${order.id}`} className="block rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <span className="text-sm font-extrabold">{order.listing.material.label}</span>
        <span className="whitespace-nowrap text-sm font-extrabold text-[var(--cyclo-teal)]">
          TZS {order.agreedPrice.toLocaleString()}
        </span>
      </div>
      <div className="text-xs text-[var(--text-2)] mb-2">
        {isBuyer
          ? t("Buying from {name}").replace("{name}", order.seller.name)
          : t("Selling to {name}").replace("{name}", order.buyer.name)}
      </div>
      <span className={`inline-block rounded-[var(--r-pill)] px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[order.paymentStatus]}`}>
        {t(STATUS_LABEL[order.paymentStatus])}
      </span>
    </Link>
  );
}

export default function ActivityPage() {
  const { t } = useLanguage();
  const { state: authState, user } = useCurrentUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  function load() {
    setState("loading");
    api
      .myOrders()
      .then((res) => {
        setOrders(res);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load your activity.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
  }, [authState]);

  const isBuyerMode = user?.role === "collector";

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Activity" />
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label={t("Loading activity…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

        {state === "ready" && orders.length === 0 && (
          <EmptyState
            title={t("No orders yet")}
            hint={isBuyerMode ? t("Buy something from the marketplace to see its progress here.") : t("Once someone buys your listing, track their payment here.")}
            action={
              <Link
                href={isBuyerMode ? "/marketplace" : "/marketplace/new"}
                className="inline-block rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm px-5 py-2.5"
              >
                {isBuyerMode ? t("Browse Marketplace") : t("List Material")}
              </Link>
            }
          />
        )}

        {state === "ready" && orders.length > 0 && user && (
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} isBuyer={o.buyerId === user.id} />
            ))}
          </div>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
