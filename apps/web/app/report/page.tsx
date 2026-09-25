"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldAlert, Paperclip, X, CheckCircle2 } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, ReportCategory, ReportContext, ReportSeverity, ReportContactPreference } from "@/lib/api";
import { resizeImageFile } from "@/lib/resizeImage";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { useLanguage } from "@/lib/i18n";

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "ACCOUNT", label: "Suspicious user/account" },
  { value: "LISTING", label: "Suspicious marketplace listing" },
  { value: "PAYMENT", label: "Suspicious payment/transaction" },
  { value: "COLLECTOR", label: "Suspicious collector/pickup" },
  { value: "BUYER_RECYCLER", label: "Suspicious buyer/recycler" },
  { value: "CHAT", label: "Suspicious message/chat" },
  { value: "MISINFORMATION", label: "Fake or misleading information" },
  { value: "FRAUDULENT_WASTE", label: "Fraudulent waste" },
  { value: "OTHER", label: "Other" },
];

const CONTEXTS: { value: ReportContext; label: string }[] = [
  { value: "MARKETPLACE", label: "In the marketplace" },
  { value: "CHAT", label: "In chat" },
  { value: "PICKUP", label: "During a pickup" },
  { value: "PAYMENT", label: "During a payment" },
  { value: "OUTSIDE_APP", label: "Outside the app" },
];

const SEVERITIES: { value: ReportSeverity; label: string; color: string }[] = [
  { value: "LOW", label: "Low — Something seems unusual", color: "var(--success)" },
  { value: "MEDIUM", label: "Medium — Possible fraud or repeated suspicious behavior", color: "var(--warning)" },
  { value: "HIGH", label: "High — Financial fraud, threats, serious safety concern", color: "var(--critical)" },
];

const CONTACT_PREFS: { value: ReportContactPreference; label: string }[] = [
  { value: "IN_APP", label: "In-app notification" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone/SMS" },
];

function ReportFormContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useCurrentUser();

  const [category, setCategory] = useState<ReportCategory>((params.get("category") as ReportCategory) || "OTHER");
  const [description, setDescription] = useState("");
  const [reportedUsername, setReportedUsername] = useState(params.get("reportedUsername") ?? "");
  const [context, setContext] = useState<ReportContext | "">((params.get("context") as ReportContext) || "");
  const [locationArea, setLocationArea] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<ReportSeverity>("LOW");
  const [contactPreference, setContactPreference] = useState<ReportContactPreference>("IN_APP");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportNumber, setReportNumber] = useState<string | null>(null);

  async function handleEvidenceAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setEvidenceError(null);
    try {
      const resized = await Promise.all(
        files.slice(0, 4 - evidence.length).map((f) => (f.type.startsWith("image/") ? resizeImageFile(f) : fileToDataUrl(f)))
      );
      setEvidence((prev) => [...prev, ...resized]);
    } catch {
      setEvidenceError(t("Couldn't attach one of those files."));
    }
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const report = await api.createReport({
        category,
        description,
        reportedUsername: reportedUsername || undefined,
        reportedUserId: params.get("reportedUserId") || undefined,
        relatedListingId: params.get("relatedListingId") || undefined,
        relatedOrderId: params.get("relatedOrderId") || undefined,
        relatedConversationId: params.get("relatedConversationId") || undefined,
        relatedPickupId: params.get("relatedPickupId") || undefined,
        context: context || undefined,
        locationArea: locationArea || undefined,
        evidence,
        severity,
        contactPreference,
      });
      setReportNumber(report.reportNumber);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Something went wrong."));
    } finally {
      setSubmitting(false);
    }
  }

  if (reportNumber) {
    return (
      <main className="min-h-screen flex flex-col bg-[var(--bg)]">
        <AppHeader title="Report Suspicious Activity" back />
        <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-10 flex flex-col items-center text-center">
          <CheckCircle2 size={48} className="mb-4 text-[var(--success)]" />
          <h1 className="text-lg font-extrabold text-[var(--text-on-bg)] mb-1">{t("Report submitted")}</h1>
          <p className="text-sm font-bold text-[var(--cyclo-teal)] mb-4">{t("Report #{number}").replace("{number}", reportNumber)}</p>
          <p className="text-sm text-[var(--text-on-bg-2)] mb-1">{t("Thank you for helping keep CYCLO safe.")}</p>
          <p className="text-sm text-[var(--text-on-bg-2)] mb-6">{t("Your report has been received and will be reviewed by our team.")}</p>
          <span className="rounded-full bg-[#FFF3DC] px-4 py-1.5 text-xs font-bold text-[var(--warning)] mb-8">{t("Status: Under Review")}</span>
          <button onClick={() => router.push("/home")} className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3">
            {t("Done")}
          </button>
        </div>
        {user && <BottomNav role={user.role} />}
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Report Suspicious Activity" back />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        <div className="mb-5 flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-3">
          <ShieldAlert size={18} className="text-[var(--warning)]" />
          <span className="text-xs text-[var(--text-2)]">{t("Reports help CYCLO investigate scams, fraud, and unsafe behavior.")}</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("What are you reporting?")}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ReportCategory)}
              className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.label)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("What happened?")}</span>
            <textarea
              required
              minLength={10}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("Describe what you saw or experienced… What happened? Who was involved? What seemed suspicious? When did it happen?")}
              className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Username / business name (if applicable)")}</span>
            <input
              value={reportedUsername}
              onChange={(e) => setReportedUsername(e.target.value)}
              placeholder="@example"
              className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Where did it happen?")}</span>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value as ReportContext)}
              className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm"
            >
              <option value="">{t("Select…")}</option>
              {CONTEXTS.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.label)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Pickup/location area (optional)")}</span>
            <input
              value={locationArea}
              onChange={(e) => setLocationArea(e.target.value)}
              placeholder={t("e.g. Kinondoni, Dar es Salaam")}
              className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Evidence (optional)")}</span>
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--r-md)] border-2 border-dashed border-[var(--border)] py-4 text-xs font-bold text-[var(--text-2)]">
              <Paperclip size={16} />
              {t("Attach photos, videos, or documents")}
              <input type="file" accept="image/*,video/*,application/pdf" multiple onChange={handleEvidenceAdd} className="hidden" />
            </label>
            {evidence.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {evidence.map((_, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-3 py-1 text-[11px] font-bold text-[var(--text-1)]">
                    {t("File")} {i + 1}
                    <button type="button" onClick={() => setEvidence((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {evidenceError && <p className="text-xs font-bold text-[var(--critical)]">{evidenceError}</p>}
            <p className="text-[11px] text-[var(--text-3)]">
              {t("Only upload evidence relevant to this report. Do not upload passwords, PINs, or other sensitive information.")}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("How serious is it?")}</span>
            {SEVERITIES.map((s) => (
              <label key={s.value} className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
                <input type="radio" name="severity" checked={severity === s.value} onChange={() => setSeverity(s.value)} />
                <span className="text-xs font-bold" style={{ color: s.color }}>
                  {t(s.label)}
                </span>
              </label>
            ))}
            <p className="text-[11px] text-[var(--text-3)]">
              {t("Severity helps CYCLO prioritize investigation — it does not automatically penalize anyone.")}
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("How can CYCLO contact you about this report?")}</span>
            <select
              value={contactPreference}
              onChange={(e) => setContactPreference(e.target.value as ReportContactPreference)}
              className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm"
            >
              {CONTACT_PREFS.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.label)}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-xs font-bold text-[var(--critical)]">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3.5 disabled:opacity-60"
          >
            {submitting ? t("Submitting…") : t("Submit Report")}
          </button>
        </form>
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportFormContent />
    </Suspense>
  );
}
