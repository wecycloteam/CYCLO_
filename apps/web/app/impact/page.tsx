"use client";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { BottomNav } from "@/components/BottomNav";
import { ImpactDashboard } from "@/components/ImpactDashboard";
import { LoadingState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

// ImpactDashboard renders its own header (title + dark-mode toggle), so this page
// doesn't also wrap it in AppHeader — that would stack two title bars.
export default function ImpactPage() {
  const { state, user } = useCurrentUser();
  const { t } = useLanguage();

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <div className="flex-1">
        {state === "loading" && <LoadingState label={t("Loading…")} />}
        {state === "ready" && <ImpactDashboard />}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
