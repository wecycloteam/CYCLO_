"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api, tokenStore, ApiError, CurrentUser } from "@/lib/api";

type LoadState = "loading" | "ready" | "error" | "unauthenticated";

const ROLE_LABELS: Record<string, string> = {
  household: "Household",
  business: "Business",
  collector: "Collector",
  recycler: "Recycling Company",
  authority: "Environmental Authority",
  admin: "CYCLO Admin",
};

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      router.replace("/login");
      return;
    }
    api
      .me()
      .then((u) => {
        setUser(u);
        setState("ready");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          tokenStore.clear();
          router.replace("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "We couldn't load your profile.");
        setState("error");
      });
  }, [router]);

  async function handleLogout() {
    const refreshToken = tokenStore.getRefresh();
    tokenStore.clear();
    if (refreshToken) {
      await api.logout(refreshToken).catch(() => undefined);
    }
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
        <Image src="/brand/cyclo-logo-light.png" alt="CYCLO" width={140} height={40} className="h-[42px] w-auto" />
        <button
          onClick={handleLogout}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--text-2)]"
        >
          Log out
        </button>
      </header>

      <div className="max-w-md mx-auto px-6 py-8">
        {state === "loading" && <p className="text-[var(--text-2)] text-sm">Loading your profile…</p>}

        {state === "error" && (
          <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="text-sm text-[var(--text-2)] mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm px-5 py-2.5"
            >
              Retry
            </button>
          </div>
        )}

        {state === "ready" && user && (
          <>
            <div className="mb-6">
              <div className="text-sm text-[var(--text-2)]">Welcome back</div>
              <div className="text-xl font-extrabold">{user.name}</div>
            </div>

            <div
              className="rounded-[var(--r-lg)] p-5 mb-6 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, var(--cyclo-teal), #1B3E41)" }}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-[#B9D6D1] mb-1">
                Account type
              </div>
              <div className="text-lg font-extrabold">{ROLE_LABELS[user.role] ?? user.role}</div>
              <div className="text-xs text-[#C7E3DE] mt-2">{user.phone}</div>
            </div>

            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-sm font-extrabold mb-2">The CYCLO loop is coming online</h3>
              <p className="text-xs text-[var(--text-2)] leading-relaxed">
                Your account and profile are live. Scanning, listing, pickups, and
                transactions ship next as the core CYCLO loop is built out — see
                CYCLO_IMPLEMENTATION_PLAN.md, Phase 2.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
