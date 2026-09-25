"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, tokenStore } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n";

// `back` is opt-in, not inferred from `title` — the bottom-nav tab pages (Marketplace,
// Activity, Chat, Profile) also pass a title but have nowhere meaningful to "go back" to
// within the app, so only drill-in/sub-pages (a listing, an order, a settings sub-page)
// pass back={true}.
export function AppHeader({ title, back }: { title?: string; back?: boolean }) {
  const router = useRouter();
  const { t } = useLanguage();

  async function handleLogout() {
    const refreshToken = tokenStore.getRefresh();
    tokenStore.clear();
    if (refreshToken) {
      await api.logout(refreshToken).catch(() => undefined);
    }
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-10 bg-[var(--chrome-bg)] border-b border-[var(--chrome-border)]">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4 px-6 py-3 md:max-w-xl lg:max-w-3xl">
        {title ? (
          <div className="flex min-w-0 items-center gap-3">
            {back && (
              <button
                onClick={() => router.back()}
                aria-label="Go back"
                className="shrink-0 text-[var(--chrome-text)]"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <span className="truncate text-lg font-extrabold text-[var(--chrome-text)]">{t(title)}</span>
          </div>
        ) : (
          <>
            <Image
              src="/brand/cyclo-logo-light.png"
              alt="CYCLO"
              width={140}
              height={40}
              className="cyclo-header-logo-light h-[42px] w-auto"
            />
            <Image
              src="/brand/cyclo-logo-dark.png"
              alt="CYCLO"
              width={140}
              height={40}
              className="cyclo-header-logo-dark h-[42px] w-auto"
            />
          </>
        )}
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="rounded-full border border-[var(--chrome-border)] px-4 py-2 text-sm font-bold text-[var(--chrome-text-muted)]"
          >
            {t("Log out")}
          </button>
        </div>
      </div>
    </header>
  );
}
