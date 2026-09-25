"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Cart } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";

export default function CartPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [cart, setCart] = useState<Cart | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  function load() {
    setState("loading");
    api
      .myCart()
      .then((c) => {
        setCart(c);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t("Something went wrong."));
        setState("error");
      });
  }

  useEffect(load, []);

  async function handleQuantityChange(itemId: string, quantityKg: number) {
    if (quantityKg <= 0) return;
    setUpdatingId(itemId);
    try {
      setCart(await api.updateCartItem(itemId, quantityKg));
    } catch {
      load();
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemove(itemId: string) {
    setUpdatingId(itemId);
    try {
      setCart(await api.removeCartItem(itemId));
    } catch {
      load();
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCheckout() {
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const res = await api.checkoutCart();
      if (res.failed.length > 0) {
        setCheckoutError(
          t("Some items couldn't be purchased: {reasons}").replace(
            "{reasons}",
            res.failed.map((f) => f.message).join(" ")
          )
        );
        load();
      }
      if (res.orders.length > 0) {
        router.push(res.orders.length === 1 ? `/orders/${res.orders[0].id}` : "/orders");
      }
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : t("Something went wrong."));
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Cart" back />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label={t("Loading your cart…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

        {state === "ready" && cart && cart.items.length === 0 && (
          <EmptyState
            title={t("Your cart is empty")}
            hint={t("Browse the marketplace and add materials to your cart.")}
            action={
              <Link href="/marketplace" className="inline-block rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm px-5 py-2.5">
                {t("Browse Marketplace")}
              </Link>
            }
          />
        )}

        {state === "ready" && cart && cart.items.length > 0 && (
          <>
            <div className="flex flex-col gap-2 mb-4">
              {cart.items.map((item) => {
                const pricePerUnit =
                  item.listing.askingPrice != null ? item.listing.askingPrice / item.listing.estimatedWeightKg : null;
                const photo = item.listing.photos[0];
                const isUpdating = updatingId === item.id;
                return (
                  <div key={item.id} className="flex gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[var(--r-sm)] bg-[var(--bg)]">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingCart size={22} className="text-[var(--text-2)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/marketplace/${item.listingId}`} className="text-sm font-extrabold text-[var(--text-1)] truncate">
                          {item.listing.material.label}
                        </Link>
                        <button onClick={() => handleRemove(item.id)} disabled={isUpdating} aria-label={t("Remove")} className="text-[var(--critical)] shrink-0">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="text-[11px] text-[var(--text-2)] mb-1">{item.listing.seller.name}</div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantityKg - 1)}
                            disabled={isUpdating || item.quantityKg <= 1}
                            className="grid h-6 w-6 place-items-center rounded-full border border-[var(--border)] text-[var(--text-1)] disabled:opacity-40"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-bold text-[var(--text-1)] min-w-8 text-center">
                            {item.quantityKg} {item.listing.quantityUnit}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantityKg + 1)}
                            disabled={isUpdating || item.quantityKg >= item.listing.estimatedWeightKg}
                            className="grid h-6 w-6 place-items-center rounded-full border border-[var(--border)] text-[var(--text-1)] disabled:opacity-40"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="text-sm font-extrabold text-[var(--cyclo-teal)]">
                          {item.subtotal != null ? `TZS ${item.subtotal.toLocaleString()}` : "—"}
                        </span>
                      </div>
                      {pricePerUnit != null && (
                        <div className="mt-0.5 text-[10px] text-[var(--text-3)]">
                          TZS {Math.round(pricePerUnit).toLocaleString()}/{item.listing.quantityUnit}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Link href="/marketplace" className="mb-4 inline-block text-xs font-bold text-[var(--cyclo-green)]">
              {t("← Continue shopping")}
            </Link>

            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4 mb-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-[var(--text-2)]">{t("Subtotal")}</span>
                <span className="font-bold text-[var(--text-1)]">TZS {cart.total.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-base pt-2 border-t border-[var(--border)]">
                <span className="font-extrabold text-[var(--text-1)]">{t("TOTAL")}</span>
                <span className="font-extrabold text-[var(--cyclo-teal)]">TZS {cart.total.toLocaleString()}</span>
              </div>
            </div>

            {checkoutError && <p className="text-xs font-bold text-[var(--critical)] mb-3">{checkoutError}</p>}

            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3.5 disabled:opacity-60"
            >
              {checkingOut ? t("Processing…") : t("Proceed to Purchase")}
            </button>
          </>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
