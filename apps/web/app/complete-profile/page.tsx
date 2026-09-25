"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { api, ApiError, CurrentUser } from "@/lib/api";
import { PasswordInput } from "@/components/PasswordInput";
import { useLanguage } from "@/lib/i18n";

// Only ever reached right after a first-time Google sign-in (see auth/callback/page.tsx) —
// a Google account starts with just name/email/googleId, none of which is enough to use
// the rest of the app (no username to be found/reviewed by, no phone for marketplace
// contact, no password for a non-Google login later). This collects exactly those, the
// same set every other signup path already requires, then hands off to the existing
// choose-mode step.
function CompleteProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const redirect = searchParams.get("redirect") || "/home";

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((u) => {
        setUser(u);
        setName(u.name);
        // A reasonable starting username from the Google name (e.g. "Deo Womuka" →
        // "deo_womuka") — the user can freely change it before submitting.
        setUsername(
          u.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 20) || ""
        );
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t("New passwords don't match."));
      return;
    }
    if (password.length < 8) {
      setError(t("New password must be at least 8 characters."));
      return;
    }
    setSubmitting(true);
    try {
      await api.updateProfile({ username, name, phone });
      await api.changePassword({ newPassword: password });
      router.replace(`/choose-mode?redirect=${encodeURIComponent(redirect)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Something went wrong."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #1B3E41 0%, #275458 55%, #24484B 100%)" }}
    >
      <div className="w-full max-w-md py-12">
        <Image
          src="/brand/cyclo-logo-dark.png"
          alt="CYCLO"
          width={160}
          height={46}
          className="mx-auto mb-6 h-auto w-[160px]"
          priority
        />
        <h1 className="text-center text-[20px] font-bold text-[#EFFBF3] mb-1">{t("Finish setting up your account")}</h1>
        <p className="text-center text-sm text-[#B9D6D1] mb-7">
          {t("Welcome, {name} — a few more details and you're in.").replace("{name}", user?.name ?? "")}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 px-1">
            <span className="text-xs font-bold text-[#8FB6AF]">{t("Username")}</span>
            <input
              type="text"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9][a-zA-Z0-9_.]{1,18}[a-zA-Z0-9]"
              title="Letters, numbers, underscore or full stop only (not at the start or end)"
              placeholder={t("Choose a username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
            />
          </label>
          <label className="flex flex-col gap-1 px-1">
            <span className="text-xs font-bold text-[#8FB6AF]">{t("Full name")}</span>
            <input
              type="text"
              required
              minLength={2}
              placeholder={t("Full name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
            />
          </label>
          <label className="flex flex-col gap-1 px-1">
            <span className="text-xs font-bold text-[#8FB6AF]">{t("Phone number")}</span>
            <input
              type="tel"
              required
              placeholder="+255 7XX XXX XXX or 07XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
            />
          </label>
          <label className="flex flex-col gap-1 px-1">
            <span className="text-xs font-bold text-[#8FB6AF]">{t("Email")}</span>
            <input
              type="email"
              disabled
              value={user?.email ?? ""}
              className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3.5 text-center text-white/60"
            />
          </label>
          <label className="flex flex-col gap-1 px-1">
            <span className="text-xs font-bold text-[#8FB6AF]">{t("Password")}</span>
            <PasswordInput
              required
              minLength={8}
              placeholder={t("Password (min. 8 characters)")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
            />
          </label>
          <label className="flex flex-col gap-1 px-1">
            <span className="text-xs font-bold text-[#8FB6AF]">{t("Confirm password")}</span>
            <PasswordInput
              required
              minLength={8}
              placeholder={t("Confirm new password")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-full border border-white/25 bg-transparent px-5 py-3.5 text-center text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--cyclo-green)]"
            />
          </label>

          {error && <p className="text-sm text-[#ffb4a8]">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] font-extrabold text-[15px] py-[15px] shadow-[0_10px_24px_rgba(72,245,59,0.28)] disabled:opacity-60"
          >
            {submitting ? t("Creating account…") : t("Create account")}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={null}>
      <CompleteProfileContent />
    </Suspense>
  );
}
