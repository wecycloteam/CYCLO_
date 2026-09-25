"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, tokenStore } from "@/lib/api";

// Landed on after apps/api's GET /auth/google/callback issues real tokens and redirects
// here — stores them exactly like the phone/email flows do, then continues on to
// wherever the login attempt originally wanted to go (see GoogleAuthGuard's `state`).
// A Google account is only ever created with a name/email/googleId (AuthService.
// loginWithGoogle) — no username, phone, or password — so before going anywhere else, a
// first-time Google sign-in is routed to /complete-profile to collect exactly those,
// same as every other signup path already requires.
function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const redirect = searchParams.get("redirect") || "/home";

    if (!accessToken || !refreshToken) {
      router.replace("/login");
      return;
    }
    tokenStore.set(accessToken, refreshToken);
    api
      .me()
      .then((user) => {
        if (!user.username) {
          router.replace(`/complete-profile?redirect=${encodeURIComponent(redirect)}`);
        } else {
          router.replace(`/choose-mode?redirect=${encodeURIComponent(redirect)}`);
        }
      })
      .catch(() => router.replace("/login"));
  }, [router, searchParams]);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #1B3E41 0%, #275458 55%, #24484B 100%)" }}
    >
      <p className="text-sm text-[#B9D6D1]">Signing you in…</p>
    </main>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
