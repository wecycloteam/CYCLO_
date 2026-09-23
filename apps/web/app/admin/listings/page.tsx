"use client";

import { useEffect, useState } from "react";
import { MapPin, Scale } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, AdminPendingListing } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { AdminGate } from "@/components/AdminGate";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

function SellerIdentity({ seller }: { seller: AdminPendingListing["seller"] }) {
  const org = seller.organizationMemberships[0]?.organization;
  return (
    <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] p-3 mb-3 text-xs">
      <div className="font-extrabold text-sm mb-1">{seller.name}</div>
      <div className="text-[var(--text-2)]">
        {seller.phone} · {seller.role}
      </div>
      {seller.collectorProfile && (
        <div className="text-[var(--text-2)]">Collector verification: {seller.collectorProfile.verificationStatus}</div>
      )}
      {org && (
        <div className="text-[var(--text-2)]">
          {org.name} ({org.type}) — {org.verificationStatus}
        </div>
      )}
    </div>
  );
}

export default function AdminListingsPage() {
  const { state: authState, user } = useCurrentUser();
  const [listings, setListings] = useState<AdminPendingListing[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});

  function load() {
    setState("loading");
    api
      .adminPendingListings()
      .then((res) => {
        setListings(res);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load pending listings.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready" && user?.role === "admin") Promise.resolve().then(load);
  }, [authState, user]);

  async function handleApprove(id: string) {
    setActingId(id);
    setActionError(null);
    try {
      await api.adminApproveListing(id);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't approve this listing.");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(id: string) {
    setActingId(id);
    setActionError(null);
    try {
      await api.adminRejectListing(id, reasonDrafts[id]);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't reject this listing.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Pending Listings" />
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-6">
        <AdminGate authState={authState} user={user}>
          {state === "loading" && <LoadingState label="Loading pending listings…" />}
          {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}

          {state === "ready" && listings.length === 0 && (
            <EmptyState title="Nothing pending review" hint="Newly published listings will show up here for approval." />
          )}

          {actionError && <p className="text-xs text-[var(--critical)] mb-3">{actionError}</p>}

          {state === "ready" && listings.length > 0 && (
            <div className="flex flex-col gap-3">
              {listings.map((listing) => (
                <div key={listing.id} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-sm font-extrabold">{listing.material.label}</span>
                    {listing.askingPrice != null && (
                      <span className="text-sm font-extrabold text-[var(--cyclo-teal)]">
                        TZS {listing.askingPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-2)] mb-3">
                    <MapPin size={12} className="inline" /> {listing.location.region ?? listing.location.label} ·{" "}
                    <Scale size={12} className="inline" /> {listing.estimatedWeightKg} kg · submitted{" "}
                    {new Date(listing.createdAt).toLocaleDateString()}
                  </div>

                  <SellerIdentity seller={listing.seller} />

                  {listing.description && <p className="text-xs text-[var(--text-2)] mb-3">{listing.description}</p>}

                  <input
                    placeholder="Rejection reason (optional)"
                    value={reasonDrafts[listing.id] ?? ""}
                    onChange={(e) => setReasonDrafts((prev) => ({ ...prev, [listing.id]: e.target.value }))}
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs mb-3"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(listing.id)}
                      disabled={actingId === listing.id}
                      className="flex-1 rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-xs py-2.5 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(listing.id)}
                      disabled={actingId === listing.id}
                      className="flex-1 rounded-full border border-[var(--critical)] text-[var(--critical)] font-bold text-xs py-2.5 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminGate>
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
