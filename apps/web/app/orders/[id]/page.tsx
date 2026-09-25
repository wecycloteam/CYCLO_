"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Order } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { LoadingState, ErrorState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { state: authState, user } = useCurrentUser();
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  function load() {
    setState("loading");
    // No single-order GET endpoint exists — the order list is small (one person's own
    // purchases/sales), so finding it there is simpler than adding a second read path.
    api
      .myOrders()
      .then((res) => {
        const found = res.find((o) => o.id === id);
        if (!found) throw new ApiError(404, "Order not found.");
        setOrder(found);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load this order.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, id]);

  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    setActing(true);
    setActionError(null);
    try {
      const updated = await api.submitOrderPayment(id, reference.trim());
      setOrder(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't submit that reference.");
    } finally {
      setActing(false);
    }
  }

  async function handleConfirm() {
    setActing(true);
    setActionError(null);
    try {
      const updated = await api.confirmOrderPayment(id);
      setOrder(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't confirm this payment.");
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    setActing(true);
    setActionError(null);
    try {
      await api.cancelOrder(id);
      router.push("/orders");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't cancel this order.");
    } finally {
      setActing(false);
    }
  }

  const isBuyer = order && user && order.buyerId === user.id;
  const isSeller = order && user && order.sellerId === user.id;

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Order" />
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label={t("Loading order…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

        {state === "ready" && order && (
          <>
            <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 mb-4">
              <div className="text-xs font-bold text-[var(--text-2)] mb-1">{order.listing.material.label}</div>
              <div className="text-2xl font-extrabold text-[var(--text-1)] mb-3">TZS {order.agreedPrice.toLocaleString()}</div>
              <div className="text-xs text-[var(--text-2)]">
                {isBuyer
                  ? t("Seller: {name}").replace("{name}", order.seller.name)
                  : t("Buyer: {name}").replace("{name}", order.buyer.name)}
              </div>
            </div>

            {actionError && <p className="text-xs font-bold text-[var(--critical)] mb-4">{actionError}</p>}

            {order.paymentStatus === "PENDING" && isBuyer && (
              <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 mb-4">
                <h2 className="text-sm font-extrabold text-[var(--text-1)] mb-2">{t("Pay by mobile money")}</h2>
                <p className="text-xs text-[var(--text-2)] mb-3">
                  {t("Send TZS {amount} to the seller").replace("{amount}", order.agreedPrice.toLocaleString())}
                  {order.seller.phone ? (
                    <>
                      {" "}
                      {t("at")} <a href={`tel:${order.seller.phone}`} className="font-bold text-[var(--cyclo-teal)]">{order.seller.phone}</a>
                    </>
                  ) : (
                    ` ${t("(ask them for their mobile money number in chat)")}`
                  )}
                  {", "}
                  {t("then enter the confirmation code your provider sent you below.")}
                </p>
                <form onSubmit={handleSubmitPayment} className="flex flex-col gap-3">
                  <input
                    required
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={t("Mobile money confirmation code")}
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={acting}
                    className="rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3 disabled:opacity-60"
                  >
                    {acting ? t("Submitting…") : t("I've Paid — Submit Code")}
                  </button>
                </form>
              </div>
            )}

            {order.paymentStatus === "PENDING" && isSeller && (
              <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 mb-4 text-center">
                <p className="text-sm font-bold text-[var(--text-1)]">{t("Waiting for the buyer to pay")}</p>
                <p className="text-xs text-[var(--text-2)] mt-1">{t("You'll be able to confirm once they submit a payment code.")}</p>
              </div>
            )}

            {order.paymentStatus === "AWAITING_CONFIRMATION" && (
              <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 mb-4">
                <h2 className="text-sm font-extrabold text-[var(--text-1)] mb-1">{t("Payment code submitted")}</h2>
                <p className="text-xs text-[var(--text-2)] mb-3">
                  {t("Reference:")} <span className="font-bold text-[var(--text-1)]">{order.paymentReference}</span>
                </p>
                {isSeller ? (
                  <>
                    <p className="text-xs text-[var(--text-2)] mb-3">
                      {t("Check your mobile money account for this payment, then confirm receipt below.")}
                    </p>
                    <button
                      onClick={handleConfirm}
                      disabled={acting}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--success)] text-white font-bold text-sm py-3 disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      {acting ? t("Confirming…") : t("Confirm Payment Received")}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-[var(--text-2)]">{t("Waiting for the seller to confirm they received your payment.")}</p>
                )}
              </div>
            )}

            {order.paymentStatus === "PAID" && (
              <div className="rounded-[var(--r-lg)] bg-[var(--success)]/10 border border-[var(--success)]/30 p-5 mb-4 text-center">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-[var(--success)]" />
                <p className="text-sm font-bold text-[var(--success)]">{t("Payment confirmed")}</p>
              </div>
            )}

            {order.paymentStatus === "CANCELLED" && (
              <div className="rounded-[var(--r-lg)] bg-[var(--critical)]/10 border border-[var(--critical)]/30 p-5 mb-4 text-center">
                <XCircle size={28} className="mx-auto mb-2 text-[var(--critical)]" />
                <p className="text-sm font-bold text-[var(--critical)]">{t("This order was cancelled")}</p>
              </div>
            )}

            {["PENDING", "AWAITING_CONFIRMATION"].includes(order.paymentStatus) && (
              <button
                onClick={handleCancel}
                disabled={acting}
                className="w-full rounded-full border border-[var(--border)] text-[var(--text-2)] font-bold text-sm py-3 disabled:opacity-60"
              >
                {t("Cancel Order")}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
