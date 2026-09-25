"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, WastePrice } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { AdminGate } from "@/components/AdminGate";
import { LoadingState, ErrorState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

export default function AdminPricingPage() {
  const { state: authState, user } = useCurrentUser();
  const [prices, setPrices] = useState<WastePrice[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setState("loading");
    api
      .wastePrices()
      .then((res) => {
        setPrices(res);
        setDrafts(Object.fromEntries(res.map((p) => [p.category, String(p.pricePerKg)])));
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load reference prices.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready" && user?.role === "admin") Promise.resolve().then(load);
  }, [authState, user]);

  async function handleSave(category: string) {
    setSavingCategory(category);
    setSaveError(null);
    try {
      const updated = await api.adminSetPrice(category, Number(drafts[category]));
      setPrices((prev) => prev.map((p) => (p.category === category ? updated : p)));
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save that price.");
    } finally {
      setSavingCategory(null);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Reference Prices" back />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        <AdminGate authState={authState} user={user}>
          <p className="text-xs text-[var(--text-on-bg-2)] mb-4">
            Sets the price/kg used everywhere &quot;Estimated Market Value&quot; is shown to users.
          </p>

          {state === "loading" && <LoadingState label="Loading prices…" />}
          {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}
          {saveError && <p className="text-xs text-[var(--critical)] mb-3">{saveError}</p>}

          {state === "ready" && (
            <div className="flex flex-col gap-2">
              {prices.map((p) => (
                <div key={p.category} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3 flex items-center gap-3">
                  <span className="flex-1 text-sm font-bold capitalize">{p.category.replace(/_/g, " ")}</span>
                  <input
                    type="number"
                    min="0"
                    value={drafts[p.category] ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [p.category]: e.target.value }))}
                    className="w-24 rounded-[var(--r-md)] border border-[var(--border)] px-2 py-1.5 text-sm text-right"
                  />
                  <button
                    onClick={() => handleSave(p.category)}
                    disabled={savingCategory === p.category || drafts[p.category] === String(p.pricePerKg)}
                    className="rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-xs px-3 py-1.5 disabled:opacity-40"
                  >
                    {savingCategory === p.category ? "…" : "Save"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </AdminGate>
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
