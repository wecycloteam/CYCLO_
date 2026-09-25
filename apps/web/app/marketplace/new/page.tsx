"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { X, Camera, Upload } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Location, WasteMaterial, WastePrice } from "@/lib/api";
import { resizeImageFile } from "@/lib/resizeImage";
import { AppHeader } from "@/components/AppHeader";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

const PICKUP_OPTIONS = [
  { value: "collection_required", label: "Needs collection" },
  { value: "seller_dropoff", label: "I'll drop it off" },
  { value: "flexible", label: "Flexible" },
];

const QUANTITY_UNITS = ["kg", "tonnes", "pieces", "litres"];
const CONDITIONS = ["Clean", "Sorted", "Mixed", "Compressed", "Damaged", "Other"];
const MAX_PHOTOS = 4;

type LoadState = "loading" | "ready" | "error";

function NewListingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanId = searchParams.get("scanId") ?? undefined;
  const scanMaterialId = searchParams.get("materialId") ?? undefined;
  const scanWeightKg = searchParams.get("weightKg") ?? undefined;
  const manual = searchParams.get("manual") === "1";
  const { t } = useLanguage();
  const { state: authState, user } = useCurrentUser();
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<WasteMaterial[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [prices, setPrices] = useState<WastePrice[]>([]);

  const [materialId, setMaterialId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [newLocationRegion, setNewLocationRegion] = useState("");
  const [newLocationDistrict, setNewLocationDistrict] = useState("");
  const [newLocationStreet, setNewLocationStreet] = useState("");
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [estimatedWeightKg, setEstimatedWeightKg] = useState(scanWeightKg ?? "");
  const [quantityUnit, setQuantityUnit] = useState("kg");
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [pickupOption, setPickupOption] = useState(PICKUP_OPTIONS[0].value);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function load() {
    setState("loading");
    Promise.all([api.wasteMaterials(), api.myLocations(), api.wastePrices()])
      .then(([m, l, p]) => {
        setMaterials(m);
        setLocations(l);
        setPrices(p);
        const scanned = scanMaterialId && m.some((material) => material.id === scanMaterialId);
        setMaterialId(scanned ? scanMaterialId! : m.length > 0 ? m[0].id : "");
        if (l.length > 0) setLocationId(l[0].id);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t("We couldn't load the listing form."));
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  const selectedMaterial = materials.find((m) => m.id === materialId);
  const pricePerKg = selectedMaterial ? prices.find((p) => p.category === selectedMaterial.category)?.pricePerKg ?? null : null;
  const estimatedMarketValue = pricePerKg != null && estimatedWeightKg ? pricePerKg * Number(estimatedWeightKg) : null;

  function handlePricePerUnitChange(value: string) {
    setPricePerUnit(value);
    const weight = Number(estimatedWeightKg || 0);
    setAskingPrice(value && weight ? String(Math.round(Number(value) * weight)) : "");
  }

  function handleAskingPriceChange(value: string) {
    setAskingPrice(value);
    const weight = Number(estimatedWeightKg || 0);
    setPricePerUnit(value && weight ? String(Math.round((Number(value) / weight) * 100) / 100) : "");
  }

  async function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setPhotoError(null);
    try {
      const remaining = MAX_PHOTOS - photos.length;
      const resized = await Promise.all(files.slice(0, remaining).map((f) => resizeImageFile(f)));
      setPhotos((prev) => [...prev, ...resized]);
    } catch {
      setPhotoError(t("Couldn't add that photo."));
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAddLocation(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const loc = await api.createLocation({
        label: newLocationLabel,
        region: newLocationRegion || undefined,
        district: newLocationDistrict || undefined,
        addressLine: newLocationStreet || undefined,
      });
      setLocations((prev) => [loc, ...prev]);
      setLocationId(loc.id);
      setNewLocationLabel("");
      setNewLocationRegion("");
      setNewLocationDistrict("");
      setNewLocationStreet("");
      setShowAddLocation(false);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("Couldn't save that location."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const listing = await api.createListing({
        materialId,
        locationId,
        estimatedWeightKg: Number(estimatedWeightKg),
        quantityUnit,
        condition: condition || undefined,
        askingPrice: askingPrice ? Number(askingPrice) : undefined,
        photos: photos.length > 0 ? photos : undefined,
        pickupOption,
        description: description || undefined,
      });
      if (scanId) {
        // Best-effort scan-history linkage (§33) — never blocks listing creation if it fails.
        api.confirmScan(scanId, materialId).catch(() => undefined);
      }
      router.push(`/marketplace/${listing.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("Couldn't create that listing."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="List Material" />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        {authState === "ready" && user?.role === "collector" ? (
          <EmptyState
            title={t("Buyer mode is buy-only")}
            hint={t("Switch to seller mode in your profile to list waste for sale.")}
            action={
              <Link href="/profile" className="inline-block rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm px-5 py-2.5">
                {t("Go to profile")}
              </Link>
            }
          />
        ) : (
          <>
        {state === "loading" && <LoadingState label={t("Loading form…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

        {state === "ready" && scanId && (
          <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-2.5 text-xs text-[var(--text-2)] mb-4">
            <span className="font-bold text-[var(--text-1)]">{t("AI Identification —")}</span> {t("material pre-filled from your scan. Change it below if it's not right.")}
          </div>
        )}
        {state === "ready" && !scanId && manual && (
          <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-2.5 text-xs text-[var(--text-2)] mb-4">
            <span className="font-bold text-[var(--text-1)]">{t("Manual Selection —")}</span> {t("choose the waste type yourself below.")}
          </div>
        )}

        {state === "ready" && (locations.length === 0 || showAddLocation) && (
          <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-5 mb-6">
            <h3 className="text-sm font-extrabold mb-1">{locations.length === 0 ? t("Add a location first") : t("Add a new location")}</h3>
            <p className="text-xs text-[var(--text-2)] mb-4">{t("Where is this material? You can reuse this location for future listings.")}</p>
            <form onSubmit={handleAddLocation} className="flex flex-col gap-3">
              <input
                required
                placeholder={t("Label (e.g. Home)")}
                value={newLocationLabel}
                onChange={(e) => setNewLocationLabel(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
              <input
                placeholder={t("Region (e.g. Arusha)")}
                value={newLocationRegion}
                onChange={(e) => setNewLocationRegion(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
              <input
                placeholder={t("District (e.g. Arusha Urban)")}
                value={newLocationDistrict}
                onChange={(e) => setNewLocationDistrict(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
              <input
                placeholder={t("Street / address")}
                value={newLocationStreet}
                onChange={(e) => setNewLocationStreet(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
              {submitError && <p className="text-xs text-[var(--critical)]">{submitError}</p>}
              <div className="flex gap-2">
                {locations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddLocation(false)}
                    className="flex-1 rounded-full border border-[var(--border)] text-[var(--text-2)] font-bold text-sm py-2.5"
                  >
                    {t("Cancel")}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-2.5 disabled:opacity-60"
                >
                  {submitting ? t("Saving…") : t("Save location")}
                </button>
              </div>
            </form>
          </div>
        )}

        {state === "ready" && locations.length > 0 && materials.length > 0 && !showAddLocation && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Material")}</span>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm bg-[var(--surface)]"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t(m.label)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Location")}</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm bg-[var(--surface)]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                    {[l.addressLine, l.district, l.region].filter(Boolean).length > 0
                      ? ` — ${[l.addressLine, l.district, l.region].filter(Boolean).join(", ")}`
                      : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddLocation(true)}
                className="self-start text-xs font-bold text-[var(--cyclo-teal)]"
              >
                {t("+ Add new location")}
              </button>
            </label>

            <div className="flex gap-3">
              <label className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Quantity")}</span>
                <input
                  required
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={estimatedWeightKg}
                  onChange={(e) => setEstimatedWeightKg(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Unit")}</span>
                <select
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2.5 text-sm bg-[var(--surface)]"
                >
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {t(u)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {quantityUnit === "kg" && (
              <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-2.5">
                <div className="text-[11px] font-bold text-[var(--text-2)] uppercase tracking-wide">{t("Estimated Market Value")}</div>
                <div className="text-lg font-extrabold text-[var(--cyclo-teal)]">
                  {estimatedMarketValue != null ? `TZS ${Math.round(estimatedMarketValue).toLocaleString()}` : t("No reference price set")}
                </div>
                <div className="text-[11px] text-[var(--text-2)]">{t("An estimate, not a guaranteed buying price.")}</div>
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Condition")}</span>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm bg-[var(--surface)]"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Photos (optional, up to {max})").replace("{max}", String(MAX_PHOTOS))}</span>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative h-16 w-16">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset */}
                    <img src={p} alt="" className="h-16 w-16 object-cover rounded-[var(--r-md)]" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--critical)] text-white"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      aria-label="Take a photo"
                      className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-[var(--r-md)] border-2 border-dashed border-[var(--border)] text-[var(--text-on-bg-2)] text-[10px] font-bold"
                    >
                      <Camera size={18} />
                      {t("Camera")}
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      aria-label="Upload from device"
                      className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-[var(--r-md)] border-2 border-dashed border-[var(--border)] text-[var(--text-on-bg-2)] text-[10px] font-bold"
                    >
                      <Upload size={18} />
                      {t("Upload")}
                    </button>
                  </>
                )}
              </div>
              {/* Two separate inputs rather than one with capture="environment" — that
                  attribute forces the camera-only UI on most mobile browsers and removes
                  the gallery option entirely. This one always opens the camera... */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoAdd}
                className="hidden"
              />
              {/* ...and this one (no capture attribute) always opens the device's normal
                  file/gallery picker. */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoAdd}
                className="hidden"
              />
              {photoError && <p className="text-xs text-[var(--critical)]">{photoError}</p>}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Pickup")}</span>
              <select
                value={pickupOption}
                onChange={(e) => setPickupOption(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm bg-[var(--surface)]"
              >
                {PICKUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-3">
              <label className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Price per {unit} — TZS (optional)").replace("{unit}", t(quantityUnit))}</span>
                <input
                  type="number"
                  min="0"
                  placeholder={t("Leave blank if unsure")}
                  value={pricePerUnit}
                  onChange={(e) => handlePricePerUnitChange(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
                />
              </label>
              <label className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Total asking price — TZS")}</span>
                <input
                  type="number"
                  min="0"
                  placeholder={t("Leave blank if unsure")}
                  value={askingPrice}
                  onChange={(e) => handleAskingPriceChange(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-on-bg-2)]">{t("Description (optional)")}</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
            </label>

            {submitError && <p className="text-xs text-[var(--critical)]">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting || !estimatedWeightKg}
              className="rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3 disabled:opacity-60"
            >
              {submitting ? t("Creating…") : t("Create Listing")}
            </button>
          </form>
        )}
          </>
        )}
      </div>
    </main>
  );
}

export default function NewListingPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewListingForm />
    </Suspense>
  );
}
