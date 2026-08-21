"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { api, tokenStore } from "@/lib/api";

export function AppHeader({ title }: { title?: string }) {
  const router = useRouter();

  async function handleLogout() {
    const refreshToken = tokenStore.getRefresh();
    tokenStore.clear();
    if (refreshToken) {
      await api.logout(refreshToken).catch(() => undefined);
    }
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
      {title ? (
        <span className="text-lg font-extrabold text-[var(--text-1)]">{title}</span>
      ) : (
        <Image src="/brand/cyclo-logo-light.png" alt="CYCLO" width={140} height={40} className="h-[42px] w-auto" />
      )}
      <button
        onClick={handleLogout}
        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--text-2)]"
      >
        Log out
      </button>
    </header>
  );
}
