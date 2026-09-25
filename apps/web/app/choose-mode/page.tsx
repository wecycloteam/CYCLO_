"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShoppingBag, Tag } from "lucide-react";
import { api, ApiError, tokenStore } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";

// Shown right after every sign-in for a household/collector account — asks explicitly
// "sell" or "buy" for this session rather than burying that choice in profile settings.
// Business/recycler/authority/admin accounts skip straight through: this mode switch
// only exists between household (seller) and collector (buyer) — see
// UsersController.updateMe's SELF_SWITCHABLE_ROLES.
function ChooseModeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/home";
  const { t } = useLanguage();

  const [checking, setChecking] = useState(true);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [saving, setSaving] = useState<"household" | "collector" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      router.replace("/login");
      return;
    }
    api
      .me()
      .then((u) => {
        if (u.role !== "household" && u.role !== "collector") {
          router.replace(redirectTo);
          return;
        }
        setCurrentRole(u.role);
        setChecking(false);
      })
      .catch(() => router.replace(redirectTo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choose(role: "household" | "collector") {
    setSaving(role);
    setError(null);
    try {
      if (role !== currentRole) {
        await api.updateProfile({ role });
      }
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Couldn't set that mode."));
      setSaving(null);
    }
  }

  if (checking) return null;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "linear-gradient(160deg, #1B3E41 0%, #275458 55%, #24484B 100%)" }}
    >
      <div className="mb-6">
        <LanguageToggle />
      </div>
      <h1 className="text-xl font-extrabold text-white mb-2">{t("How do you want to use CYCLO?")}</h1>
      <p className="text-sm text-[#B9D6D1] mb-8 max-w-xs">
        {t("You can switch this any time from your profile.")}
      </p>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={() => choose("household")}
          disabled={saving !== null}
          className="flex items-center justify-center gap-2 rounded-full bg-[var(--cyclo-green)] px-6 py-4 text-[15px] font-extrabold text-[#0E2A1F] disabled:opacity-60"
        >
          <Tag size={18} />
          {saving === "household" ? t("Setting up…") : t("Enter as Seller")}
        </button>
        <button
          onClick={() => choose("collector")}
          disabled={saving !== null}
          className="flex items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-4 text-[15px] font-extrabold text-white disabled:opacity-60"
        >
          <ShoppingBag size={18} />
          {saving === "collector" ? t("Setting up…") : t("Enter as Buyer")}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-[#ffb4a8]">{error}</p>}
    </main>
  );
}

export default function ChooseModePage() {
  return (
    <Suspense fallback={null}>
      <ChooseModeContent />
    </Suspense>
  );
}
