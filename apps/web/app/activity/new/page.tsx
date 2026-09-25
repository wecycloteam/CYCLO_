"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Location, WasteListing, WasteMaterial } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { LoadingState, ErrorState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

function NewPickupRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listingId = searchParams.get("listingId") ?? undefined;
  const scanMaterialId = searchParams.get("materialId") ?? undefined;
  const scanWeightKg = searchParams.get("weightKg") ?? undefined;
  const { state: authState } = useCurrentUser();

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<WasteListing | null>(null);
  const [materials, setMaterials] = useState<WasteMaterial[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [materialId, setMaterialId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [estimatedWeightKg, setEstimatedWeightKg] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function load() {
    setState("loading");
    Promise.all([
      api.myLocations(),
      listingId ? api.getListing(listingId) : Promise.resolve(null),
      listingId ? Promise.resolve<WasteMaterial[]>([]) : api.wasteMaterials(),
    ])
      .then(([l, listingRes, m]) => {
        setLocations(l);
        if (l.length > 0) setLocationId(l[0].id);
        if (listingRes) {
          setListing(listingRes);
          setLocationId(listingRes.locationId);
        } else {
          setMaterials(m);
          const scanned = scanMaterialId && m.some((material) => material.id === scanMaterialId);
          setMaterialId(scanned ? scanMaterialId! : m.length > 0 ? m[0].id : "");
          if (scanWeightKg) setEstimatedWeightKg(scanWeightKg);
        }
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load this form.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, listingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const pickup = await api.createPickupRequest({
        locationId,
        listingId,
        materialId: listingId ? undefined : materialId,
        estimatedWeightKg: listingId ? undefined : Number(estimatedWeightKg),
        notes: notes || undefined,
      });
      router.push(`/activity/${pickup.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't request a pickup.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Request Pickup" />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label="Loading form…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}

        {state === "ready" && locations.length === 0 && (
          <p className="text-sm text-[var(--text-on-bg-2)]">
            You need a saved location first — add one from the Marketplace &rarr; List Material flow, then come back here.
          </p>
        )}

        {state === "ready" && locations.length > 0 && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {listing ? (
              <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="text-xs font-bold text-[var(--text-2)] mb-1">Collecting for your listing</div>
                <div className="text-sm font-extrabold">{listing.material.label}</div>
                <div className="text-xs text-[var(--text-2)]">{listing.estimatedWeightKg} kg estimated</div>
              </div>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-[var(--text-on-bg-2)]">Material</span>
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
                  <span className="text-xs font-bold text-[var(--text-on-bg-2)]">Estimated weight (kg)</span>
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
              </>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-[var(--text-on-bg-2)]">Pickup location</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={!!listing}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm bg-[var(--surface)] disabled:opacity-60"
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
              <span className="text-xs font-bold text-[var(--text-on-bg-2)]">Notes (optional)</span>
              <textarea
                rows={3}
                placeholder="Anything the collector should know"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
              />
            </label>

            {submitError && <p className="text-xs text-[var(--critical)]">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3 disabled:opacity-60"
            >
              {submitting ? "Requesting…" : "Request Pickup"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function NewPickupRequestPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewPickupRequestForm />
    </Suspense>
  );
}
