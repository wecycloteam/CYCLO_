"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tokenStore } from "@/lib/api";

// Landed on after apps/api's GET /auth/google/callback issues real tokens and redirects
// here — stores them exactly like the phone/email flows do, then continues on to
// wherever the login attempt originally wanted to go (see GoogleAuthGuard's `state`).
function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const redirect = searchParams.get("redirect") || "/home";

    if (accessToken && refreshToken) {
      tokenStore.set(accessToken, refreshToken);
      router.replace(`/choose-mode?redirect=${encodeURIComponent(redirect)}`);
    } else {
      router.replace("/login");
    }
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
