"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Location, WasteMaterial, WastePrice } from "@/lib/api";
import { resizeImageFile } from "@/lib/resizeImage";
import { AppHeader } from "@/components/AppHeader";
import { LoadingState, ErrorState } from "@/components/AsyncState";

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
  const { state: authState } = useCurrentUser();
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<WasteMaterial[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [prices, setPrices] = useState<WastePrice[]>([]);

  const [materialId, setMaterialId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [newLocationRegion, setNewLocationRegion] = useState("");
  const [estimatedWeightKg, setEstimatedWeightKg] = useState(scanWeightKg ?? "");
  const [quantityUnit, setQuantityUnit] = useState("kg");
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [pickupOption, setPickupOption] = useState(PICKUP_OPTIONS[0].value);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        setError(err instanceof ApiError ? err.message : "We couldn't load the listing form.");
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
      setPhotoError("Couldn't add that photo.");
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
      const loc = await api.createLocation({ label: newLocationLabel, region: newLocationRegion || undefined });
      setLocations((prev) => [loc, ...prev]);
      setLocationId(loc.id);
      setNewLocationLabel("");
      setNewLocationRegion("");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't save that location.");
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
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't create that listing.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="List Material" />
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label="Loading form…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}

        {state === "ready" && scanId && (
          <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-2.5 text-xs text-[var(--text-2)] mb-4">
            <span className="font-bold text-[var(--text-1)]">AI Identification —</span> material pre-filled from your
            scan. Change it below if it&apos;s not right.
          </div>
        )}
        {state === "ready" && !scanId && manual && (
          <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-2.5 text-xs text-[var(--text-2)] mb-4">
            <span className="font-bold text-[var(--text-1)]">Manual Selection —</span> choose the waste type yourself
            below.
          </div>
        )}

        {state === "ready" && locations.length === 0 && (
          <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-5 mb-6">
            <h3 className="text-sm font-extrabold mb-1">Add a location first</h3>
            <p className="text-xs text-[var(--text-2)] mb-4">Where is this material? You can reuse this location for future listings.</p>
            <form onSubmit={handleAddLocation} className="flex flex-col gap-3">
              <input
                required
                placeholder="Label (e.g. Home)"
                value={newLocationLabel}
                onChange={(e) => setNewLocationLabel(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
              <input
                placeholder="Region (e.g. Arusha)"
                value={newLocationRegion}
                onChange={(e) => setNewLocationRegion(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
              {submitError && <p className="text-xs text-[var(--critical)]">{submitError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-2.5 disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Save location"}
              </button>
            </form>
          </div>
        )}

        {state === "ready" && locations.length > 0 && materials.length > 0 && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-2)]">Material</span>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm bg-[var(--surface)]"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-2)]">Location</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm bg-[var(--surface)]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                    {l.region ? ` — ${l.region}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-3">
              <label className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[var(--text-2)]">Quantity</span>
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
                <span className="text-xs font-bold text-[var(--text-2)]">Unit</span>
                <select
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2.5 text-sm bg-[var(--surface)]"
                >
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {quantityUnit === "kg" && (
              <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-2.5">
                <div className="text-[11px] font-bold text-[var(--text-2)] uppercase tracking-wide">Estimated Market Value</div>
                <div className="text-lg font-extrabold text-[var(--cyclo-teal)]">
                  {estimatedMarketValue != null ? `TZS ${Math.round(estimatedMarketValue).toLocaleString()}` : "No reference price set"}
                </div>
                <div className="text-[11px] text-[var(--text-2)]">An estimate, not a guaranteed buying price.</div>
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-2)]">Condition</span>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm bg-[var(--surface)]"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-2)]">Photos (optional, up to {MAX_PHOTOS})</span>
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
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-16 w-16 rounded-[var(--r-md)] border-2 border-dashed border-[var(--border)] text-[var(--text-2)] text-xs flex items-center justify-center"
                  >
                    + Add
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoAdd}
                className="hidden"
              />
              {photoError && <p className="text-xs text-[var(--critical)]">{photoError}</p>}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-2)]">Pickup</span>
              <select
                value={pickupOption}
                onChange={(e) => setPickupOption(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm bg-[var(--surface)]"
              >
                {PICKUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-3">
              <label className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[var(--text-2)]">Price per {quantityUnit} — TZS (optional)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Leave blank if unsure"
                  value={pricePerUnit}
                  onChange={(e) => handlePricePerUnitChange(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
                />
              </label>
              <label className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[var(--text-2)]">Total asking price — TZS</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Leave blank if unsure"
                  value={askingPrice}
                  onChange={(e) => handleAskingPriceChange(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-2)]">Description (optional)</span>
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
              {submitting ? "Creating…" : "Create Listing"}
            </button>
          </form>
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
