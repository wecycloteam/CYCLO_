"use client";

import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, BadgeCheck, CalendarClock } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, WasteListing } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";

const PERK_ICON: Record<string, typeof Sparkles> = {
  boost: TrendingUp,
  featured: BadgeCheck,
  listing_upgrade: CalendarClock,
};

interface Perk {
  id: string;
  label: string;
  description: string;
  costCC: number;
  requiresListing: boolean;
}

export default function RedeemCCPage() {
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const [perks, setPerks] = useState<Perk[]>([]);
  const [listings, setListings] = useState<WasteListing[]>([]);
  const [creditsCC, setCreditsCC] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedPerk, setSelectedPerk] = useState<Perk | null>(null);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  function load() {
    setState("loading");
    Promise.all([api.walletPerks(), api.myListings(), api.myWallet()])
      .then(([p, l, w]) => {
        setPerks(p);
        setListings(l.filter((li) => li.status === "ACTIVE"));
        setCreditsCC(w.creditsCC);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t("Something went wrong."));
        setState("error");
      });
  }

  useEffect(load, []);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPerk) return;
    setRedeemError(null);
    setRedeemSuccess(null);
    setRedeeming(true);
    try {
      if (selectedPerk.id === "boost") await api.redeemBoost(selectedListingId);
      else if (selectedPerk.id === "featured") await api.redeemFeatured();
      else if (selectedPerk.id === "listing_upgrade") await api.redeemListingUpgrade(selectedListingId);
      setRedeemSuccess(t("Redeemed! Your perk is now active."));
      setCreditsCC((c) => c - selectedPerk.costCC);
      setSelectedPerk(null);
      setSelectedListingId("");
    } catch (err) {
      setRedeemError(err instanceof ApiError ? err.message : t("Something went wrong."));
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Redeem CYCLO Credits" back />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label={t("Loading…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

        {state === "ready" && (
          <>
            <div className="mb-5 flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-3">
              <Sparkles size={18} className="text-[var(--cyclo-green)]" />
              <span className="text-sm font-bold text-[var(--text-1)]">
                {t("You have {cc} CC").replace("{cc}", creditsCC.toLocaleString())}
              </span>
            </div>

            {!selectedPerk && (
              <div className="flex flex-col gap-2">
                {perks.map((p) => {
                  const Icon = PERK_ICON[p.id] ?? Sparkles;
                  const canAfford = creditsCC >= p.costCC;
                  return (
                    <button
                      key={p.id}
                      onClick={() => canAfford && setSelectedPerk(p)}
                      disabled={!canAfford}
                      className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4 text-left disabled:opacity-50"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--cyclo-teal)]/10 text-[var(--cyclo-teal)]">
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-[var(--text-1)]">{t(p.label)}</span>
                          <span className="whitespace-nowrap text-xs font-extrabold text-[var(--cyclo-green-deep)]">{p.costCC} CC</span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-2)]">{t(p.description)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedPerk && (
              <form onSubmit={handleRedeem} className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
                <h2 className="mb-1 text-sm font-extrabold text-[var(--text-1)]">{t(selectedPerk.label)}</h2>
                <p className="mb-3 text-xs text-[var(--text-2)]">{t(selectedPerk.description)}</p>

                {selectedPerk.requiresListing && (
                  <label className="mb-3 flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-[var(--text-2)]">{t("Choose a listing")}</span>
                    {listings.length === 0 ? (
                      <EmptyState title={t("No active listings")} hint={t("List something first to use this perk.")} />
                    ) : (
                      <select
                        required
                        value={selectedListingId}
                        onChange={(e) => setSelectedListingId(e.target.value)}
                        className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm"
                      >
                        <option value="" disabled>
                          {t("Select…")}
                        </option>
                        {listings.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.material.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                )}

                {redeemError && <p className="mb-3 text-xs font-bold text-[var(--critical)]">{redeemError}</p>}
                {redeemSuccess && <p className="mb-3 text-xs font-bold text-[var(--success)]">{redeemSuccess}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPerk(null)}
                    className="flex-1 rounded-full border border-[var(--border)] text-[var(--text-2)] font-bold text-sm py-2.5"
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={redeeming || (selectedPerk.requiresListing && !selectedListingId)}
                    className="flex-1 rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-2.5 disabled:opacity-60"
                  >
                    {redeeming ? t("Redeeming…") : t("Redeem for {cc} CC").replace("{cc}", String(selectedPerk.costCC))}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
