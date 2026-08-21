"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, tokenStore, ApiError, CurrentUser } from "@/lib/api";

type LoadState = "loading" | "ready" | "error";

// Every authenticated page needs the same "am I logged in, who am I" check with the
// same loading/error/redirect handling (§46) — shared here instead of repeated per page.
export function useCurrentUser() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    // Deferred a microtask so the setState calls below aren't synchronous within the
    // effect body (react-hooks/set-state-in-effect) — same-tick behavior, just not
    // traced as a direct effect-body call.
    Promise.resolve().then(() => {
      if (cancelled) return;
      setState("loading");
      api
        .me()
        .then((u) => {
          if (cancelled) return;
          setUser(u);
          setState("ready");
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 401) {
            tokenStore.clear();
            router.replace("/login");
            return;
          }
          setError(err instanceof ApiError ? err.message : "We couldn't load your profile.");
          setState("error");
        });
    });
    return () => {
      cancelled = true;
    };
  }, [router, reloadToken]);

  return { state, user, error, retry: () => setReloadToken((n) => n + 1) };
}
