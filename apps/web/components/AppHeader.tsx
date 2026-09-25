"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { api, tokenStore } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n";

export function AppHeader({ title }: { title?: string }) {
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
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-3 bg-[var(--chrome-bg)] border-b border-[var(--chrome-border)]">
      {title ? (
        <span className="text-lg font-extrabold text-[var(--chrome-text)]">{t(title)}</span>
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
    </header>
  );
}
