"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, ScanResponse, WastePrice } from "@/lib/api";
import { resizeImageFile } from "@/lib/resizeImage";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type Step = "capture" | "live" | "classifying" | "result" | "error";

const MAX_DIMENSION = 900;

export default function ScanPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { state: authState, user } = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<Step>("capture");
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [prices, setPrices] = useState<WastePrice[]>([]);
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    if (authState === "ready") api.wastePrices().then(setPrices).catch(() => undefined);
  }, [authState]);

  const pricePerKg = scan ? prices.find((p) => p.category === scan.result.category)?.pricePerKg ?? null : null;
  const estimatedValue = pricePerKg != null ? pricePerKg * Number(quantity || 0) : null;

  // Stop the live camera stream whenever we leave the "live" step (capture, cancel, or
  // navigating away) — an open MediaStream left running drains battery and keeps the
  // camera's hardware light on for no reason.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function openLiveCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera isn't supported in this browser. Choose a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setStep("live");
      // The <video> element only exists once step==="live" renders, so attach on the next tick.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setCameraError("Couldn't access your camera (blocked, unavailable, or no permission). Choose a photo instead.");
    }
  }

  function cancelLiveCamera() {
    stopCamera();
    setStep("capture");
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    submitImage(canvas.toDataURL("image/jpeg", 0.75));
  }

  async function submitImage(dataUrl: string) {
    setStep("classifying");
    setError(null);
    setPreview(dataUrl);
    try {
      const res = await api.scanWaste(dataUrl);
      setScan(res);
      setStep("result");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong.");
      setStep("error");
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file for a retry
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      setStep("error");
      return;
    }
    try {
      submitImage(await resizeImageFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that photo.");
      setStep("error");
    }
  }

  function reset() {
    stopCamera();
    setStep("capture");
    setScan(null);
    setPreview(null);
    setError(null);
    setCameraError(null);
    setQuantity("1");
  }

  function useForListing() {
    if (!scan) return;
    const params = new URLSearchParams();
    if (scan.suggestedMaterialId) params.set("materialId", scan.suggestedMaterialId);
    params.set("scanId", scan.scanId);
    if (quantity) params.set("weightKg", quantity);
    router.push(`/marketplace/new?${params.toString()}`);
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Scan Waste" />
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-8">
        {authState === "loading" && <LoadingState />}

        {authState === "ready" && step === "capture" && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-full aspect-square rounded-[var(--r-lg)] border-2 border-dashed border-[var(--border)] bg-[var(--surface)] flex flex-col items-center justify-center gap-2 text-[var(--text-2)]">
              <Camera size={48} strokeWidth={1.5} />
              <span className="text-sm">{t("Point your camera at a material to identify it")}</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
            <button
              onClick={openLiveCamera}
              className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3.5"
            >
              {t("Open Camera")}
            </button>
            {cameraError && <p className="text-xs text-[var(--critical)]">{cameraError}</p>}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-full border border-[var(--border)] text-[var(--text-on-bg)] font-bold text-sm py-3"
            >
              {t("Upload a Photo Instead")}
            </button>

            <div className="w-full flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[11px] font-bold text-[var(--text-on-bg-2)]">{t("OR")}</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
            <button
              onClick={() => router.push("/marketplace/new?manual=1")}
              className="w-full rounded-full border border-[var(--border)] text-[var(--text-on-bg)] font-bold text-sm py-3.5"
            >
              {t("Select Waste Manually")}
            </button>
            <p className="text-xs text-[var(--text-on-bg-2)]">
              {t("AI identification can misread a material — choose the category yourself instead.")}
            </p>
          </div>
        )}

        {authState === "ready" && step === "live" && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-full aspect-square rounded-[var(--r-lg)] overflow-hidden bg-black relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <button
              onClick={capturePhoto}
              className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3.5"
            >
              {t("Capture Photo")}
            </button>
            <button
              onClick={cancelLiveCamera}
              className="w-full rounded-full border border-[var(--border)] text-[var(--text-on-bg-2)] font-bold text-sm py-3"
            >
              {t("Cancel")}
            </button>
          </div>
        )}

        {authState === "ready" && step === "classifying" && (
          <div className="flex flex-col items-center text-center gap-4">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
              <img src={preview} alt="Captured waste" className="w-full aspect-square object-cover rounded-[var(--r-lg)]" />
            )}
            <LoadingState label={t("Identifying material…")} />
          </div>
        )}

        {authState === "ready" && step === "error" && (
          <div className="flex flex-col items-center text-center gap-4">
            <p className="text-sm text-[var(--critical)]">{error}</p>
            <button onClick={reset} className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3.5">
              {t("Try Again")}
            </button>
            <button
              onClick={() => router.push("/marketplace/new?manual=1")}
              className="w-full rounded-full border border-[var(--border)] text-[var(--text-on-bg)] font-bold text-sm py-3.5"
            >
              {t("Select Waste Manually Instead")}
            </button>
          </div>
        )}

        {authState === "ready" && step === "result" && scan && (
          <div className="flex flex-col gap-4">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
              <img src={preview} alt="Captured waste" className="w-full aspect-square object-cover rounded-[var(--r-lg)]" />
            )}

            {scan.result.mock && (
              <div className="rounded-[var(--r-md)] bg-[var(--warning)]/15 border border-[var(--warning)]/40 px-4 py-2 text-xs font-bold text-[var(--warning)] text-center">
                {t("DEMO MODE — this is a placeholder result, not a real AI classification yet")}
              </div>
            )}

            <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="text-lg font-extrabold mb-1">{scan.result.label}</div>
              <div className="text-sm text-[var(--text-2)] mb-3">
                {Math.round(scan.result.confidence * 100)}% {t("confidence")} ·{" "}
                {scan.result.recyclable ? t("Recyclable") : t("Not recyclable")}
                {scan.result.condition && <> · {t(scan.result.condition.charAt(0) + scan.result.condition.slice(1).toLowerCase())} {t("condition")}</>}
              </div>
              {scan.result.conditionNotes && (
                <p className="text-xs text-[var(--text-2)] mb-3 italic">{scan.result.conditionNotes}</p>
              )}

              <label className="flex flex-col gap-1.5 mb-3">
                <span className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wide">{t("Estimated quantity (kg)")}</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
                />
              </label>

              <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-3 mb-3">
                <div className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wide">{t("Estimated Market Value")}</div>
                <div className="text-xl font-extrabold text-[var(--cyclo-teal)]">
                  {estimatedValue != null ? `TZS ${Math.round(estimatedValue).toLocaleString()}` : t("No reference price set yet")}
                </div>
                <div className="text-[11px] text-[var(--text-2)]">{t("An estimate, not a guaranteed buying price.")}</div>
              </div>

              <div className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wide mb-1">{t("Recommended action")}</div>
              <p className="text-sm font-bold text-[var(--text-1)] mb-3">{scan.result.recommendedAction}</p>

              <div className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wide mb-1">{t("Suggested next steps")}</div>
              <ul className="text-sm text-[var(--text-1)] list-disc list-inside space-y-0.5">
                {scan.result.handlingInstructions.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>

            <button
              onClick={useForListing}
              className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3.5"
            >
              {t("List This Waste")}
            </button>
            <button
              onClick={reset}
              className="w-full rounded-full border border-[var(--border)] text-[var(--text-on-bg-2)] font-bold text-sm py-3.5"
            >
              Scan Again
            </button>
          </div>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
