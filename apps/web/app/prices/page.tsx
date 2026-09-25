"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, WastePrice } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState, ErrorState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";

// §7/§17 — CYCLO's pitch specifically emphasizes transparent pricing, so this reads the
// same admin-editable reference prices every "Estimated Market Value" is computed from —
// never a separate, possibly-stale number.
export default function WastePricesPage() {
  const { state: authState, user } = useCurrentUser();
  const { t } = useLanguage();
  const [prices, setPrices] = useState<WastePrice[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  function load() {
    setState("loading");
    api
      .wastePrices()
      .then((res) => {
        setPrices(res);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t("We couldn't load reference prices."));
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
  }, [authState]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Waste Prices" />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        <p className="text-xs text-[var(--text-on-bg-2)] mb-4">
          {t("Reference prices per kg, set by CYCLO admins. Used to estimate a listing's market value — not a guaranteed buying price.")}
        </p>

        {state === "loading" && <LoadingState label={t("Loading prices…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

        {state === "ready" && (
          <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {prices.map((p) => (
              <div key={p.category} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-bold capitalize">{t(p.category.replace(/_/g, " "))}</span>
                <span className="text-sm font-extrabold text-[var(--cyclo-teal)]">TZS {p.pricePerKg.toLocaleString()}/kg</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
