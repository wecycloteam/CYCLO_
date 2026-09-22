"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { api, tokenStore, ApiError, API_URL } from "@/lib/api";

type Method = "phone" | "email";
type PhoneStep = "phone" | "code";
type EmailMode = "signin" | "signup";

const ROLE_OPTIONS = [
  { value: "household", label: "I'm a Household" },
  { value: "business", label: "I'm a Business" },
  { value: "collector", label: "I'm a Waste Collector" },
  { value: "recycler", label: "I'm a Recycling Company" },
];

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.85.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function LoginSplash({ visible }: { visible: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{ background: "linear-gradient(160deg, #1B3E41 0%, #275458 55%, #24484B 100%)" }}
      aria-hidden={!visible}
    >
      <div className="relative flex items-center justify-center">
        <span className="cyclo-splash-ring absolute h-40 w-40 rounded-full border-2 border-[var(--cyclo-green)]/40" />
        <span className="cyclo-splash-ring absolute h-40 w-40 rounded-full border-2 border-[var(--cyclo-green)]/40 [animation-delay:0.4s]" />
        <Image
          src="/brand/cyclo-logo-dark.png"
          alt="CYCLO"
          width={180}
          height={52}
          className="cyclo-splash-logo relative h-auto w-[180px]"
          priority
        />
      </div>
      <style jsx>{`
        .cyclo-splash-logo {
          animation: cyclo-logo-in 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .cyclo-splash-ring {
          animation: cyclo-ring-pulse 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        @keyframes cyclo-logo-in {
          0% {
            opacity: 0;
            transform: scale(0.55) rotate(-6deg);
            filter: blur(6px);
          }
          60% {
            opacity: 1;
            transform: scale(1.06) rotate(1deg);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes cyclo-ring-pulse {
          0% {
            opacity: 0.6;
            transform: scale(0.6);
          }
          100% {
            opacity: 0;
            transform: scale(1.6);
          }
        }
      `}</style>
    </div>
  );
}

function GoogleButton({ redirectTo }: { redirectTo: string }) {
  const href = `${API_URL}/auth/google?redirect=${encodeURIComponent(redirectTo)}`;
  return (
    <a
      href={href}
      className="flex w-full items-center justify-center gap-3 rounded-full border border-white/25 bg-white px-5 py-3.5 text-[15px] font-bold text-[#1B3E41] transition hover:bg-[#F6F9F8]"
    >
      <GoogleMark />
      Continue with Google
    </a>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/home";

  const [showSplash, setShowSplash] = useState(true);
  const [method, setMethod] = useState<Method>("phone");

  // Phone/OTP flow
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpName, setOtpName] = useState("");
  const [otpRole, setOtpRole] = useState("household");
  const [devCode, setDevCode] = useState<string | null>(null);

  // Email/password flow
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailName, setEmailName] = useState("");
  const [emailPhone, setEmailPhone] = useState("");
  const [emailRole, setEmailRole] = useState("household");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1300);
    return () => clearTimeout(t);
  }, []);

  function finishLogin(tokens: { accessToken: string; refreshToken: string }) {
    tokenStore.set(tokens.accessToken, tokens.refreshToken);
    router.push(redirectTo);
  }

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
      setPhoneStep("code");
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
      const tokens = await api.verifyOtp({ phone, code, name: otpName || undefined, role: otpRole });
      finishLogin(tokens);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await api.login({ email, password });
      finishLogin(tokens);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await api.register({
        email,
        password,
        phone: emailPhone,
        name: emailName,
        role: emailRole,
      });
      finishLogin(tokens);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <LoginSplash visible={showSplash} />
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

        <div
          className={`relative z-10 w-full max-w-md text-center py-12 transition-all duration-500 ${
            showSplash ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <Image
            src="/brand/cyclo-logo-dark.png"
            alt="CYCLO — Turning Waste Into Wealth"
            width={220}
            height={64}
            className="mx-auto mb-7 h-auto w-[220px]"
            priority
          />

          <h1 className="text-[22px] font-bold leading-snug text-[#EFFBF3] mb-2">
            Your waste has value.
            <br />
            Let&rsquo;s put it to work.
          </h1>
          <p className="text-sm text-[#B9D6D1] mb-7 leading-relaxed">Log in or create a free account to continue.</p>

          <div className="mb-6">
            <GoogleButton redirectTo={redirectTo} />
          </div>

          <div className="mb-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/15" />
            <span className="text-xs font-bold uppercase tracking-wide text-[#8FB6AF]">or</span>
            <span className="h-px flex-1 bg-white/15" />
          </div>

          <div className="mb-7 flex rounded-full border border-white/25 p-1">
            <button
              type="button"
              onClick={() => {
                setMethod("phone");
                setError(null);
              }}
              className={`flex-1 rounded-full px-4 py-2 text-xs font-bold transition ${
                method === "phone" ? "bg-[var(--cyclo-green)] text-[#0E2A1F]" : "text-[#EFFBF3]"
              }`}
            >
              Phone
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod("email");
                setError(null);
              }}
              className={`flex-1 rounded-full px-4 py-2 text-xs font-bold transition ${
                method === "email" ? "bg-[var(--cyclo-green)] text-[#0E2A1F]" : "text-[#EFFBF3]"
              }`}
            >
              Email &amp; Password
            </button>
          </div>

          {method === "phone" && phoneStep === "phone" && (
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
          )}

          {method === "phone" && phoneStep === "code" && (
            <>
              <p className="text-sm text-[#B9D6D1] mb-4 leading-relaxed">We sent a 6-digit code to {phone}.</p>
              {devCode && (
                <div className="mb-4 rounded-2xl border border-dashed border-[var(--cyclo-green)]/50 bg-black/20 px-4 py-3 text-xs text-[#B9D6D1]">
                  <span className="font-bold text-[var(--cyclo-green)]">DEV MODE</span> — no SMS is actually sent
                  locally, so the real code is shown here and pre-filled below:{" "}
                  <span className="font-mono tracking-widest">{devCode}</span>
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
                  value={otpName}
                  onChange={(e) => setOtpName(e.target.value)}
                  className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
                />
                <select
                  value={otpRole}
                  onChange={(e) => setOtpRole(e.target.value)}
                  className="w-full rounded-full border border-white/25 bg-[#1B3E41] px-5 py-3.5 text-center text-white focus:outline-none focus:border-[var(--cyclo-green)]"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} (first time only)
                    </option>
                  ))}
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
                    setPhoneStep("phone");
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

          {method === "email" && (
            <>
              <div className="mb-5 flex justify-center gap-6 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode("signin");
                    setError(null);
                  }}
                  className={emailMode === "signin" ? "text-[var(--cyclo-green)]" : "text-[#8FB6AF]"}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode("signup");
                    setError(null);
                  }}
                  className={emailMode === "signup" ? "text-[var(--cyclo-green)]" : "text-[#8FB6AF]"}
                >
                  Create account
                </button>
              </div>

              {emailMode === "signin" ? (
                <form onSubmit={handleEmailSignIn} className="flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
                  />
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
                  />
                  {error && <p className="text-sm text-[#ffb4a8]">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] font-extrabold text-[15px] py-[15px] shadow-[0_10px_24px_rgba(72,245,59,0.28)] disabled:opacity-60"
                  >
                    {loading ? "Signing in…" : "Sign in"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleEmailSignUp} className="flex flex-col gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={emailName}
                    onChange={(e) => setEmailName(e.target.value)}
                    className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
                  />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="+255 7XX XXX XXX"
                    value={emailPhone}
                    onChange={(e) => setEmailPhone(e.target.value)}
                    className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Password (min. 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
                  />
                  <select
                    value={emailRole}
                    onChange={(e) => setEmailRole(e.target.value)}
                    className="w-full rounded-full border border-white/25 bg-[#1B3E41] px-5 py-3.5 text-center text-white focus:outline-none focus:border-[var(--cyclo-green)]"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {error && <p className="text-sm text-[#ffb4a8]">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] font-extrabold text-[15px] py-[15px] shadow-[0_10px_24px_rgba(72,245,59,0.28)] disabled:opacity-60"
                  >
                    {loading ? "Creating account…" : "Create account"}
                  </button>
                </form>
              )}
            </>
          )}

          <div className="mt-7 text-xs text-[#8FB6AF]">
            By continuing you agree to CYCLO&rsquo;s Terms and Privacy Policy.
          </div>
        </div>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
