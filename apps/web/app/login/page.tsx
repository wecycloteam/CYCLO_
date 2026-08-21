"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api, tokenStore, ApiError } from "@/lib/api";

type Step = "phone" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("household");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.requestOtp(phone);
      // devCode only ever comes back from the dev SMS stub (never in production) —
      // see apps/api SmsProvider.exposesCodeInResponse.
      setDevCode(res.devCode ?? null);
      setCode(res.devCode ?? "");
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await api.verifyOtp({ phone, code, name: name || undefined, role });
      tokenStore.set(tokens.accessToken, tokens.refreshToken);
      router.push("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-6"
      style={{
        background: "linear-gradient(160deg, #1B3E41 0%, #275458 55%, #24484B 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 640,
          height: 640,
          top: -200,
          right: -160,
          background: "radial-gradient(circle, rgba(72,245,59,0.18), transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md text-center py-12">
        <Image
          src="/brand/cyclo-logo-dark.png"
          alt="CYCLO — Turning Waste Into Wealth"
          width={220}
          height={64}
          className="mx-auto mb-9 h-auto w-[220px]"
          priority
        />

        {step === "phone" && (
          <>
            <h1 className="text-[22px] font-bold leading-snug text-[#EFFBF3] mb-2">
              Your waste has value.
              <br />
              Let&rsquo;s put it to work.
            </h1>
            <p className="text-sm text-[#B9D6D1] mb-9 leading-relaxed">
              Enter your phone number to get started or log back in.
            </p>
            <form onSubmit={handleRequestOtp} className="flex flex-col gap-3">
              <input
                type="tel"
                required
                placeholder="+255 7XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
              />
              {error && <p className="text-sm text-[#ffb4a8]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] font-extrabold text-[15px] py-[15px] shadow-[0_10px_24px_rgba(72,245,59,0.28)] disabled:opacity-60"
              >
                {loading ? "Sending code…" : "Continue"}
              </button>
            </form>
          </>
        )}

        {step === "code" && (
          <>
            <h1 className="text-[22px] font-bold leading-snug text-[#EFFBF3] mb-2">
              Enter the code we sent you
            </h1>
            <p className="text-sm text-[#B9D6D1] mb-9 leading-relaxed">
              We sent a 6-digit code to {phone}.
            </p>
            {devCode && (
              <div className="mb-6 rounded-2xl border border-dashed border-[var(--cyclo-green)]/50 bg-black/20 px-4 py-3 text-xs text-[#B9D6D1]">
                <span className="font-bold text-[var(--cyclo-green)]">DEV MODE</span> — no SMS is actually sent
                locally, so the real code is shown here and pre-filled below: <span className="font-mono tracking-widest">{devCode}</span>
              </div>
            )}
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
              <input
                type="text"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center tracking-[0.4em] text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
              />
              <input
                type="text"
                placeholder="Your name (first time only)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-full border border-white/25 bg-[#1B3E41] px-5 py-3.5 text-center text-white focus:outline-none focus:border-[var(--cyclo-green)]"
              >
                <option value="household">I&rsquo;m a Household (first time only)</option>
                <option value="business">I&rsquo;m a Business</option>
                <option value="collector">I&rsquo;m a Waste Collector</option>
                <option value="recycler">I&rsquo;m a Recycling Company</option>
              </select>
              {error && <p className="text-sm text-[#ffb4a8]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] font-extrabold text-[15px] py-[15px] shadow-[0_10px_24px_rgba(72,245,59,0.28)] disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Verify & Continue"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setDevCode(null);
                  setCode("");
                }}
                className="w-full rounded-full border border-white/25 text-[#EFFBF3] font-bold text-sm py-3.5"
              >
                Use a different number
              </button>
            </form>
          </>
        )}

        <div className="mt-7 text-xs text-[#8FB6AF]">
          By continuing you agree to CYCLO&rsquo;s Terms and Privacy Policy.
        </div>
      </div>
    </main>
  );
}
