"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, WasteListing } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState, ErrorState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state: authState, user } = useCurrentUser();
  const [listing, setListing] = useState<WasteListing | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  function load() {
    setState("loading");
    api
      .getListing(id)
      .then((l) => {
        setListing(l);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load this listing.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, id]);

  async function handlePublish() {
    if (!listing) return;
    setActing(true);
    setActionError(null);
    try {
      setListing(await api.publishListing(listing.id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't publish this listing.");
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    if (!listing) return;
    setActing(true);
    setActionError(null);
    try {
      setListing(await api.cancelListing(listing.id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't cancel this listing.");
    } finally {
      setActing(false);
    }
  }

  const isOwner = user && listing && listing.sellerId === user.id;

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Listing" />
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label="Loading listing…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}

        {state === "ready" && listing && (
          <>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="text-lg font-extrabold">{listing.material.label}</h1>
              <StatusBadge status={listing.status} />
            </div>
            {listing.askingPrice != null && (
              <div className="text-2xl font-extrabold text-[var(--cyclo-teal)] mb-4">
                TZS {listing.askingPrice.toLocaleString()}
              </div>
            )}

            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] mb-6">
              <Row k="Estimated weight" v={`${listing.estimatedWeightKg} kg`} />
              {listing.verifiedWeightKg != null && <Row k="Verified weight" v={`${listing.verifiedWeightKg} kg`} />}
              {listing.condition && <Row k="Condition" v={listing.condition} />}
              <Row k="Location" v={listing.location.region ?? listing.location.label} />
              <Row k="Pickup" v={listing.pickupOption.replace(/_/g, " ")} />
            </div>

            {listing.description && <p className="text-sm text-[var(--text-2)] mb-6">{listing.description}</p>}

            {actionError && <p className="text-xs text-[var(--critical)] mb-3">{actionError}</p>}

            {isOwner && listing.status === "DRAFT" && (
              <button
                onClick={handlePublish}
                disabled={acting}
                className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3 mb-2 disabled:opacity-60"
              >
                {acting ? "Publishing…" : "Publish Listing"}
              </button>
            )}

            {isOwner && listing.status === "ACTIVE" && (
              <Link
                href={`/activity/new?listingId=${listing.id}`}
                className="block text-center w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3 mb-2"
              >
                Request Pickup
              </Link>
            )}

            {isOwner && ["DRAFT", "ACTIVE"].includes(listing.status) && (
              <button
                onClick={handleCancel}
                disabled={acting}
                className="w-full rounded-full border border-[var(--border)] text-[var(--text-2)] font-bold text-sm py-3 disabled:opacity-60"
              >
                {acting ? "Cancelling…" : "Cancel Listing"}
              </button>
            )}

            {!isOwner && (
              <button
                onClick={() => router.back()}
                className="w-full rounded-full border border-[var(--border)] text-[var(--text-2)] font-bold text-sm py-3"
              >
                Back
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-[var(--text-2)]">{k}</span>
      <span className="text-sm font-bold capitalize">{v}</span>
    </div>
  );
}
