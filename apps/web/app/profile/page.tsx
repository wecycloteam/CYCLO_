"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Pencil, X, Check, Camera, Lock, Wallet as WalletIcon } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError } from "@/lib/api";
import { resizeImageFile } from "@/lib/resizeImage";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PasswordInput } from "@/components/PasswordInput";
import { LoadingState, ErrorState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

// household/collector are the two self-switchable "modes" (see the toggle below) — their
// labels spell out Seller/Buyer explicitly so the account type row reflects which side of
// the marketplace this account currently acts on, not just the underlying role name.
const ROLE_LABELS: Record<string, string> = {
  household: "Household (Waste Seller)",
  business: "Business",
  collector: "Collector (Waste Buyer)",
  recycler: "Recycling Company",
  authority: "Environmental Authority",
  admin: "CYCLO Admin",
};

const VERIFICATION_LABELS: Record<string, string> = {
  unverified: "Not yet reviewed",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Not approved",
  suspended: "Suspended",
};

function Avatar({ url, name, size = 64 }: { url: string | null | undefined; name: string; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
    return <img src={url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-[var(--cyclo-teal)] font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size / 2.5 }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useLanguage();
  const { state, user, error, retry } = useCurrentUser();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [mode, setMode] = useState<"household" | "collector">("household");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const canSwitchMode = user?.role === "household" || user?.role === "collector";

  function startEditing() {
    if (!user) return;
    setName(user.name);
    setUsername(user.username ?? "");
    setPhone(user.phone ?? "");
    setAvatarUrl(user.avatarUrl);
    if (user.role === "household" || user.role === "collector") setMode(user.role);
    setSaveError(null);
    setAvatarError(null);
    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(null);
    setEditing(true);
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword.length < 8) {
      setPasswordError(t("New password must be at least 8 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("New passwords don't match."));
      return;
    }
    setChangingPassword(true);
    try {
      await api.changePassword({ currentPassword: currentPassword || undefined, newPassword });
      setPasswordSuccess(t("Password updated."));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : t("We couldn't update your password."));
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    try {
      setAvatarUrl(await resizeImageFile(file));
    } catch {
      setAvatarError(t("Couldn't use that photo."));
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateProfile({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        username: username.trim() || undefined,
        avatarUrl: avatarUrl ?? undefined,
        role: canSwitchMode ? mode : undefined,
      });
      setEditing(false);
      retry();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t("We couldn't save your changes."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Profile" />

      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-8">
        {state === "loading" && <LoadingState label={t("Loading your profile…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={retry} />}

        {state === "ready" && user && !editing && (
          <>
            <div className="flex flex-col items-center text-center mb-6">
              <Avatar url={user.avatarUrl} name={user.name} />
              <div className="mt-3 flex items-center gap-2">
                <div className="text-lg font-extrabold text-[var(--text-on-bg)]">{user.name}</div>
                <VerifiedBadge status={user.verificationStatus} />
              </div>
              {user.username && (
                <div className="text-sm font-semibold text-[var(--cyclo-green)]">@{user.username}</div>
              )}
              <div className="text-sm text-[var(--text-on-bg-2)]">{user.phone ?? t("No phone on file")}</div>

              <button
                onClick={startEditing}
                className="mt-4 flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--text-1)]"
              >
                <Pencil size={14} />
                {t("Edit profile")}
              </button>
            </div>

            <Link
              href="/wallet"
              className="mb-4 flex items-center justify-between rounded-[var(--r-md)] p-4 text-white"
              style={{ background: "linear-gradient(135deg, var(--cyclo-teal), #1B3E41)" }}
            >
              <div className="flex items-center gap-2">
                <WalletIcon size={18} />
                <span className="text-sm font-extrabold">{t("CYCLO Wallet")}</span>
              </div>
              <span className="text-xs font-bold text-[#B9D6D1]">{t("View →")}</span>
            </Link>

            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-2)]">{t("Username")}</span>
                <span className="text-sm font-bold">{user.username ?? t("Not set")}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-2)]">{t("Account type")}</span>
                <span className="text-sm font-bold">{t(ROLE_LABELS[user.role] ?? user.role)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-2)]">{t("Verification")}</span>
                <span className="text-sm font-bold">{t(VERIFICATION_LABELS[user.verificationStatus] ?? user.verificationStatus)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-2)]">{t("Country")}</span>
                <span className="text-sm font-bold">{user.country}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-2)]">{t("Member since")}</span>
                <span className="text-sm font-bold">
                  {new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
                </span>
              </div>
            </div>
          </>
        )}

        {state === "ready" && user && editing && (
          <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[var(--text-1)]">{t("Edit profile")}</h2>
              <button onClick={() => setEditing(false)} aria-label="Cancel" className="text-[var(--text-2)]">
                <X size={18} />
              </button>
            </div>

            <div className="mb-5 flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative"
                aria-label="Change profile photo"
              >
                <Avatar url={avatarUrl} name={name || user.name} size={72} />
                <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-[var(--cyclo-teal)] text-white">
                  <Camera size={12} />
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
              {avatarError && <p className="mt-2 text-xs font-bold text-[var(--critical)]">{avatarError}</p>}
            </div>

            {canSwitchMode && (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-bold text-[var(--text-2)]">{t("I want to")}</label>
                <div className="flex rounded-[var(--r-pill)] border border-[var(--border)] p-1">
                  <button
                    type="button"
                    onClick={() => setMode("household")}
                    className={`flex-1 rounded-[var(--r-pill)] py-2 text-xs font-bold ${
                      mode === "household" ? "bg-[var(--cyclo-teal)] text-white" : "text-[var(--text-2)]"
                    }`}
                  >
                    {t("Sell waste")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("collector")}
                    className={`flex-1 rounded-[var(--r-pill)] py-2 text-xs font-bold ${
                      mode === "collector" ? "bg-[var(--cyclo-teal)] text-white" : "text-[var(--text-2)]"
                    }`}
                  >
                    {t("Buy / collect waste")}
                  </button>
                </div>
                {mode !== user.role && (
                  <p className="mt-1.5 text-[11px] text-[var(--text-2)]">
                    {mode === "collector"
                      ? t("Switches your account to a collector — you'll see and accept pickup jobs instead of your own listings.")
                      : t("Switches your account back to a household seller.")}
                  </p>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold text-[var(--text-2)]">{t("Username")}</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-1)]"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold text-[var(--text-2)]">{t("Full name")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-1)]"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold text-[var(--text-2)]">{t("Phone number")}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+255712345678 or 0712345678"
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-1)]"
              />
            </div>

            <div className="mb-4 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setShowPasswordForm((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-2)]">
                  <Lock size={14} /> {t("Change password")}
                </span>
                <span className="text-xs font-bold text-[var(--cyclo-teal)]">{showPasswordForm ? t("Hide") : t("Change")}</span>
              </button>

              {showPasswordForm && (
                <div className="mt-3 flex flex-col gap-3">
                  <PasswordInput
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t("Current password")}
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 pr-10 text-sm text-[var(--text-1)]"
                  />
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("New password (min. 8 characters)")}
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 pr-10 text-sm text-[var(--text-1)]"
                  />
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("Confirm new password")}
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 pr-10 text-sm text-[var(--text-1)]"
                  />
                  {passwordError && <p className="text-xs font-bold text-[var(--critical)]">{passwordError}</p>}
                  {passwordSuccess && <p className="text-xs font-bold text-[var(--success)]">{passwordSuccess}</p>}
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword}
                    className="w-full rounded-full border border-[var(--cyclo-teal)] py-2.5 text-sm font-bold text-[var(--cyclo-teal)] disabled:opacity-60"
                  >
                    {changingPassword ? t("Updating…") : t("Update password")}
                  </button>
                </div>
              )}
            </div>

            {saveError && <p className="mb-4 text-xs font-bold text-[var(--critical)]">{saveError}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--cyclo-teal)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Check size={16} />
              {saving ? t("Saving…") : t("Save changes")}
            </button>
          </div>
        )}
      </div>

      {user && <BottomNav role={user.role} />}
    </main>
  );
}
