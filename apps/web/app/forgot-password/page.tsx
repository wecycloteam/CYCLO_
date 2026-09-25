"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PasswordInput } from "@/components/PasswordInput";
import { useLanguage } from "@/lib/i18n";

type Step = "email" | "code";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.requestPasswordReset(email);
      setInfo(res.devCode ? `${res.message} (dev code: ${res.devCode})` : res.message);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError(t("New password must be at least 8 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("New passwords don't match."));
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword({ email, code: code.trim(), newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #1B3E41 0%, #275458 55%, #24484B 100%)" }}
    >
      <div className="w-full max-w-md text-center py-12">
        <Link href="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-[#8FB6AF]">
          <ArrowLeft size={16} /> {t("Back to login")}
        </Link>

        <h1 className="text-xl font-extrabold text-[#EFFBF3] mb-2">{t("Reset your password")}</h1>

        {done ? (
          <>
            <p className="text-sm text-[#B9D6D1] mb-7">{t("Your password has been reset. You can now log in with your new password.")}</p>
            <Link
              href="/login"
              className="inline-block w-full rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] font-extrabold text-[15px] py-[15px]"
            >
              {t("Go to login")}
            </Link>
          </>
        ) : step === "email" ? (
          <>
            <p className="text-sm text-[#B9D6D1] mb-7">{t("Enter the email on your account and we'll send you a verification code.")}</p>
            <form onSubmit={handleRequestCode} className="flex flex-col gap-3">
              <input
                type="email"
                required
                placeholder={t("Your email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
              />
              {error && <p className="text-sm text-[#ffb4a8]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] font-extrabold text-[15px] py-[15px] disabled:opacity-60"
              >
                {loading ? t("Sending…") : t("Send verification code")}
              </button>
            </form>
          </>
        ) : (
          <>
            {info && <p className="text-sm text-[#B9D6D1] mb-5">{info}</p>}
            <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
              <input
                required
                inputMode="numeric"
                maxLength={6}
                placeholder={t("6-digit code")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center tracking-[0.4em] text-white placeholder:text-white/50 placeholder:tracking-normal focus:outline-none focus:border-[var(--cyclo-green)]"
              />
              <PasswordInput
                required
                placeholder={t("New password (min. 8 characters)")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
              />
              <PasswordInput
                required
                placeholder={t("Confirm new password")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
              />
              {error && <p className="text-sm text-[#ffb4a8]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] font-extrabold text-[15px] py-[15px] disabled:opacity-60"
              >
                {loading ? t("Resetting…") : t("Reset password")}
              </button>
              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-xs font-bold text-[#8FB6AF]"
              >
                {t("Use a different email")}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
