"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet as WalletIcon, Plus, X, Sparkles } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Wallet, WalletProvider } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState, ErrorState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";

// Real brand colors, rendered as text marks rather than each provider's actual logo file —
// this app has no license to redistribute those images, but the colored, named pill still
// reads as a real, recognized payment option rather than a generic placeholder.
const PROVIDER_STYLE: Record<string, { bg: string; text: string }> = {
  mpesa: { bg: "#4CAF50", text: "#FFFFFF" },
  mixx_by_yas: { bg: "#FDB913", text: "#1B1B1B" },
  airtel_money: { bg: "#ED1C24", text: "#FFFFFF" },
  halopesa: { bg: "#F7941D", text: "#FFFFFF" },
  nmb_mkononi: { bg: "#00954C", text: "#FFFFFF" },
  crdb_simbanking: { bg: "#00558C", text: "#FFFFFF" },
  nbc_mobile: { bg: "#8A1538", text: "#FFFFFF" },
};

const TX_LABEL: Record<string, string> = {
  TOPUP: "Wallet top-up",
  PURCHASE: "Marketplace purchase",
  SALE_EARNING: "Sale earning",
  CC_REDEMPTION: "CC redeemed",
  REFUND: "Refund",
};

export default function WalletPage() {
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [providers, setProviders] = useState<WalletProvider[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const [showTopUp, setShowTopUp] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [topUpSuccess, setTopUpSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setState("loading");
    Promise.all([api.myWallet(), api.walletProviders()])
      .then(([w, p]) => {
        setWallet(w);
        setProviders(p);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t("Something went wrong."));
        setState("error");
      });
  }

  useEffect(load, []);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    setTopUpError(null);
    setTopUpSuccess(null);
    const amountTzs = Number(amount);
    if (!provider) {
      setTopUpError(t("Choose a payment provider."));
      return;
    }
    if (!amountTzs || amountTzs <= 0) {
      setTopUpError(t("Enter an amount greater than 0."));
      return;
    }
    setSubmitting(true);
    try {
      const updated = await api.topUpWallet(provider, amountTzs);
      setWallet((prev) => (prev ? { ...updated, transactions: prev.transactions } : updated));
      api.myWallet().then(setWallet).catch(() => undefined);
      setTopUpSuccess(t("Top-up successful."));
      setAmount("");
      setProvider(null);
      setTimeout(() => setShowTopUp(false), 1200);
    } catch (err) {
      setTopUpError(err instanceof ApiError ? err.message : t("Something went wrong."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="CYCLO Wallet" back />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label={t("Loading your wallet…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

        {state === "ready" && wallet && (
          <>
            <div
              className="rounded-[var(--r-lg)] p-6 mb-4 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, var(--cyclo-teal), #1B3E41)" }}
            >
              <div className="flex items-center gap-2 mb-1 text-xs font-bold uppercase tracking-wide text-[#B9D6D1]">
                <WalletIcon size={14} /> {t("Wallet balance")}
              </div>
              <div className="text-3xl font-extrabold mb-4">TZS {Math.round(wallet.balanceTzs).toLocaleString()}</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <Sparkles size={14} className="text-[var(--cyclo-green)]" />
                  {wallet.creditsCC.toLocaleString()} {t("CC")}
                </div>
                <button
                  onClick={() => setShowTopUp(true)}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--cyclo-green)] px-4 py-2 text-xs font-extrabold text-[#0E2A1F]"
                >
                  <Plus size={14} /> {t("Top Up")}
                </button>
              </div>
            </div>

            {user?.role !== "collector" && (
              <Link
                href="/wallet/redeem"
                className="mb-4 flex items-center justify-between rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-1)]">
                  <Sparkles size={16} className="text-[var(--cyclo-green)]" /> {t("Redeem CC for seller perks")}
                </span>
                <span className="text-xs font-bold text-[var(--cyclo-teal)]">{t("View →")}</span>
              </Link>
            )}

            {showTopUp && (
              <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 mb-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-[var(--text-1)]">{t("Top Up Wallet")}</h2>
                  <button onClick={() => setShowTopUp(false)} aria-label={t("Cancel")} className="text-[var(--text-2)]">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleTopUp} className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[var(--text-2)]">{t("Choose a payment method")}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {providers.map((p) => {
                        const style = PROVIDER_STYLE[p.id] ?? { bg: "#275458", text: "#FFFFFF" };
                        const selected = provider === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProvider(p.id)}
                            style={{ background: style.bg, color: style.text }}
                            className={`rounded-[var(--r-md)] px-3 py-3 text-sm font-extrabold text-center transition ${
                              selected ? "ring-2 ring-offset-2 ring-[var(--cyclo-teal)] ring-offset-[var(--surface)]" : "opacity-90"
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-[var(--text-2)]">{t("Amount (TZS)")}</span>
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="10000"
                      className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-1)]"
                    />
                  </label>
                  {topUpError && <p className="text-xs font-bold text-[var(--critical)]">{topUpError}</p>}
                  {topUpSuccess && <p className="text-xs font-bold text-[var(--success)]">{topUpSuccess}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3 disabled:opacity-60"
                  >
                    {submitting ? t("Processing…") : t("Confirm Top Up")}
                  </button>
                </form>
              </div>
            )}

            <h3 className="text-sm font-extrabold text-[var(--text-on-bg)] mb-3">{t("Recent activity")}</h3>
            {wallet.transactions.length === 0 && (
              <p className="text-xs text-[var(--text-on-bg-2)]">{t("No wallet activity yet.")}</p>
            )}
            <div className="flex flex-col gap-2">
              {wallet.transactions.map((tx) => {
                const isCredit = (tx.amountTzs ?? 0) > 0 || (tx.amountCC ?? 0) > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-[var(--text-1)]">{t(TX_LABEL[tx.type] ?? tx.type)}</div>
                      <div className="text-[11px] text-[var(--text-2)]">
                        {new Date(tx.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                    <span className={`text-sm font-extrabold ${isCredit ? "text-[var(--success)]" : "text-[var(--critical)]"}`}>
                      {tx.amountTzs != null
                        ? `${tx.amountTzs > 0 ? "+" : ""}TZS ${Math.round(tx.amountTzs).toLocaleString()}`
                        : `${(tx.amountCC ?? 0) > 0 ? "+" : ""}${tx.amountCC} CC`}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
