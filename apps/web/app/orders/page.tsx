"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Order } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting payment",
  AWAITING_CONFIRMATION: "Payment submitted",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-[#FFF3DC] text-[var(--warning)]",
  AWAITING_CONFIRMATION: "bg-[#E4EEFC] text-[var(--cyclo-teal)]",
  PAID: "bg-[#E4F7E2] text-[var(--success)]",
  CANCELLED: "bg-[#FCE3DE] text-[var(--critical)]",
};

export default function OrdersPage() {
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
        setError(err instanceof ApiError ? err.message : "We couldn't load your orders.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
  }, [authState]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Orders & Payments" />
      <div className="flex-1 max-w-md w-full mx-auto px-5 py-6">
        {state === "loading" && <LoadingState label="Loading your orders…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}

        {state === "ready" && orders.length === 0 && (
          <EmptyState title="No orders yet" hint="Buy Now on a listing to start a purchase and pay in-app." />
        )}

        {state === "ready" && orders.length > 0 && user && (
          <div className="flex flex-col gap-2">
            {orders.map((o) => {
              const isBuyer = o.buyerId === user.id;
              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-extrabold text-[var(--text-1)]">{o.listing.material.label}</span>
                      <span className="whitespace-nowrap text-sm font-extrabold text-[var(--cyclo-teal)]">
                        TZS {o.agreedPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-2)] mb-2">
                      {isBuyer ? `Buying from ${o.seller.name}` : `Selling to ${o.buyer.name}`}
                    </div>
                    <span className={`inline-block rounded-[var(--r-pill)] px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[o.paymentStatus]}`}>
                      {STATUS_LABEL[o.paymentStatus]}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
