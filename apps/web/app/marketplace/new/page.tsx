"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Location, WasteMaterial } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { LoadingState, ErrorState } from "@/components/AsyncState";

const PICKUP_OPTIONS = [
  { value: "collection_required", label: "Needs collection" },
  { value: "seller_dropoff", label: "I'll drop it off" },
  { value: "flexible", label: "Flexible" },
];

type LoadState = "loading" | "ready" | "error";

export default function NewListingPage() {
  const router = useRouter();
  const { state: authState } = useCurrentUser();
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<WasteMaterial[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [materialId, setMaterialId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [newLocationRegion, setNewLocationRegion] = useState("");
  const [estimatedWeightKg, setEstimatedWeightKg] = useState("");
  const [condition, setCondition] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [pickupOption, setPickupOption] = useState(PICKUP_OPTIONS[0].value);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function load() {
    setState("loading");
    Promise.all([api.wasteMaterials(), api.myLocations()])
      .then(([m, l]) => {
        setMaterials(m);
        setLocations(l);
        if (m.length > 0) setMaterialId(m[0].id);
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
  }, [authState]);

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
        condition: condition || undefined,
        askingPrice: askingPrice ? Number(askingPrice) : undefined,
        pickupOption,
        description: description || undefined,
      });
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

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-2)]">Estimated weight (kg)</span>
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
              <span className="text-xs font-bold text-[var(--text-2)]">Condition (optional)</span>
              <input
                placeholder="e.g. clean, sorted"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
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

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-2)]">Asking price — TZS (optional)</span>
              <input
                type="number"
                min="0"
                placeholder="Leave blank if unsure"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
            </label>

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
