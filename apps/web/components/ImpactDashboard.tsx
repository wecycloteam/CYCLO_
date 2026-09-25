"use client";

import { useEffect, useState } from "react";
import {
  Recycle,
  Magnet,
  FileText,
  Package,
  Shirt,
  GlassWater,
  Cpu,
  Leaf,
  Trash2,
  Sprout,
  Repeat,
  Trophy,
  Wallet,
  Scale,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError, UserImpactSummary } from "@/lib/api";
import { getStoredTheme, setTheme as persistTheme } from "@/lib/theme";
import { LoadingState, ErrorState } from "@/components/AsyncState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n";

// Mirrors home/page.tsx's CATEGORY_ICON — kept local since it's a small, stable map; not
// worth a shared module for eight lookup entries used in two places.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  plastic: Recycle,
  metal: Magnet,
  paper: FileText,
  cardboard: Package,
  textile: Shirt,
  glass: GlassWater,
  e_waste: Cpu,
  organic: Leaf,
  other: Trash2,
};

const CATEGORY_LABEL: Record<string, string> = {
  plastic: "Plastic",
  metal: "Metal",
  paper: "Paper",
  cardboard: "Cardboard",
  textile: "Textile",
  glass: "Glass",
  e_waste: "Electronics",
  organic: "Organic",
  other: "Other",
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL);

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  recycle: Recycle,
  sprout: Sprout,
  repeat: Repeat,
  trophy: Trophy,
};

function TopCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center gap-2 text-[var(--cyclo-teal)]">
        <Icon size={18} />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-2)]">{label}</span>
      </div>
      <div className="text-xl font-extrabold text-[var(--text-1)]">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-[var(--text-3)]">{hint}</div>}
    </div>
  );
}

export function ImpactDashboard() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<UserImpactSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Activates the dark theme that already exists in the design tokens
    // (html[data-theme="dark"]) but nothing in the app applied until this page.
    const theme = getStoredTheme() ?? "dark";
    persistTheme(theme);
  }, []);

  function load() {
    setState("loading");
    api
      .myImpactSummary()
      .then((res) => {
        setSummary(res);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t("We couldn't load your impact data."));
        setState("error");
      });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-5 py-6">
      <div className="mx-auto flex max-w-2xl items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-extrabold text-[var(--text-1)]">{t("Your Impact")}</h1>
          <p className="text-xs text-[var(--text-2)]">{t("Real numbers from your completed pickups — nothing estimated except where labeled.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        {state === "loading" && <LoadingState label={t("Loading your impact…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

        {state === "ready" && summary && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2">
              <TopCard icon={Sparkles} label={t("Eco Score")} value={`${summary.ecoScore} / 100`} hint={t("Activity-based, not a certification")} />
              <TopCard icon={Wallet} label={t("Money Earned")} value={`TZS ${Math.round(summary.totalEarningsTzs).toLocaleString()}`} />
            </div>

            <div className="mb-6 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-1 flex items-center gap-2">
                <Scale size={18} className="text-[var(--cyclo-teal)]" />
                <h2 className="text-sm font-extrabold text-[var(--text-1)]">{t("Waste diverted")}</h2>
              </div>
              <div className="mb-4 text-2xl font-extrabold text-[var(--text-1)]">{summary.totalWeightKg} kg</div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {ALL_CATEGORIES.map((category) => {
                  const Icon = CATEGORY_ICON[category] ?? Trash2;
                  const weight = summary.materialBreakdown.find((m) => m.category === category)?.weightKg ?? 0;
                  return (
                    <div key={category} className="flex flex-col items-center gap-1 rounded-[var(--r-md)] bg-[var(--bg)] py-3 text-center">
                      <Icon size={18} className="text-[var(--text-2)]" />
                      <span className="text-xs font-bold text-[var(--text-1)]">{weight} kg</span>
                      <span className="text-[9px] text-[var(--text-3)]">{t(CATEGORY_LABEL[category])}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3">
              <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-1 flex items-center gap-2 text-[var(--success)]">
                  <Leaf size={16} />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-2)]">{t("Environmental impact")}</span>
                </div>
                <div className="text-lg font-extrabold text-[var(--text-1)]">{summary.estimatedCo2AvoidedKg} kg</div>
                <div className="mt-0.5 text-[10px] text-[var(--text-3)]">{t("Estimated CO2e avoided — a rough, category-based estimate, not a measurement.")}</div>
              </div>
              <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-1 flex items-center gap-2 text-[var(--cyclo-teal)]">
                  <Repeat size={16} />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-2)]">{t("Collections")}</span>
                </div>
                <div className="text-lg font-extrabold text-[var(--text-1)]">{summary.completedTransactionCount}</div>
                <div className="mt-0.5 text-[10px] text-[var(--text-3)]">{t("Completed pickups, verified and paid.")}</div>
              </div>
            </div>

            <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="mb-3 text-sm font-extrabold text-[var(--text-1)]">{t("Achievements")}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {summary.achievements.map((a) => {
                  const Icon = ACHIEVEMENT_ICONS[a.icon] ?? Trophy;
                  return (
                    <div
                      key={a.id}
                      className={`flex flex-col items-center gap-1.5 rounded-[var(--r-md)] border p-3 text-center ${
                        a.achieved
                          ? "border-[var(--cyclo-green)]/40 bg-[var(--cyclo-green)]/10"
                          : "border-[var(--border)] bg-[var(--bg)] opacity-60"
                      }`}
                    >
                      <Icon size={22} className={a.achieved ? "text-[var(--cyclo-green-deep)]" : "text-[var(--text-3)]"} />
                      <span className="text-[11px] font-bold text-[var(--text-1)]">{a.label}</span>
                      {!a.achieved && (
                        <span className="text-[9px] text-[var(--text-3)]">
                          {a.progress}/{a.threshold}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
