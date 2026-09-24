"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, PickupRequest, WasteEvent } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { StarRatingInput } from "@/components/StarRating";
import { LoadingState, ErrorState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

const EVENT_LABELS: Record<string, string> = {
  PICKUP_REQUESTED: "Pickup requested",
  PICKUP_ACCEPTED: "Collector accepted",
  PICKUP_EN_ROUTE: "Collector on the way",
  PICKUP_ARRIVED: "Collector arrived",
  PICKUP_COLLECTING: "Collection in progress",
  PICKUP_WEIGHED: "Weight verified",
  PICKUP_COMPLETED: "Pickup completed",
  PICKUP_CANCELLED: "Cancelled",
  TRANSACTION_CREATED: "Transaction recorded",
};

export default function PickupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state: authState, user } = useCurrentUser();
  const [pickup, setPickup] = useState<PickupRequest | null>(null);
  const [events, setEvents] = useState<WasteEvent[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [reviewable, setReviewable] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  function load() {
    setState("loading");
    Promise.all([api.getPickupRequest(id), api.pickupEvents(id), api.reviewableTransactions().catch(() => [])])
      .then(([p, e, reviewable]) => {
        setPickup(p);
        setEvents(e);
        setReviewable(!!p.transaction && reviewable.some((t) => t.id === p.transaction!.id));
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load this pickup.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, id]);

  async function runAction(fn: () => Promise<PickupRequest>) {
    setActing(true);
    setActionError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "That action didn't go through.");
    } finally {
      setActing(false);
    }
  }

  async function handleComplete() {
    setActing(true);
    setActionError(null);
    try {
      await api.completePickup(id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't complete this pickup.");
    } finally {
      setActing(false);
    }
  }

  const isProducer = user && pickup && pickup.producerId === user.id;
  const isAssignedCollector = user && pickup && pickup.assignedCollectorId === user.id;
  const cancellable = pickup && !["WEIGHED", "COMPLETED", "CANCELLED", "DISPUTED"].includes(pickup.status);

  async function handleSubmitReview() {
    if (!pickup?.transaction) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      await api.createReview({ transactionId: pickup.transaction.id, rating: reviewRating, comment: reviewComment.trim() || undefined });
      setReviewSubmitted(true);
      setReviewable(false);
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Couldn't submit your review.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Pickup" />
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label="Loading pickup…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}

        {state === "ready" && pickup && (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-lg font-extrabold text-[var(--text-on-bg)]">{pickup.material.label}</h1>
                <div className="text-xs text-[var(--text-on-bg-2)]">{pickup.location.region ?? pickup.location.label}</div>
              </div>
              <StatusBadge status={pickup.status} />
            </div>

            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] mb-6">
              <Row k="Estimated weight" v={`${pickup.estimatedWeightKg} kg`} />
              {pickup.verifiedWeightKg != null && <Row k="Verified weight" v={`${pickup.verifiedWeightKg} kg`} />}
              {pickup.notes && <Row k="Notes" v={pickup.notes} />}
            </div>

            {pickup.transaction && (
              <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] p-4 mb-6">
                <div className="text-xs font-bold text-[var(--text-2)] mb-1">Transaction recorded</div>
                <div className="text-sm font-extrabold mb-1">{pickup.transaction.reference}</div>
                <div className="text-xs text-[var(--text-2)]">
                  {pickup.transaction.verifiedWeightKg} kg
                  {pickup.transaction.agreedPrice != null && ` · TZS ${pickup.transaction.agreedPrice.toLocaleString()}`}
                  {" · payment "}
                  {pickup.transaction.paymentStatus.toLowerCase()}
                </div>
              </div>
            )}

            {isAssignedCollector && reviewable && !reviewSubmitted && (
              <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4 mb-6">
                <div className="text-sm font-extrabold text-[var(--text-1)] mb-2">Rate this seller</div>
                <StarRatingInput value={reviewRating} onChange={setReviewRating} />
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Optional comment…"
                  rows={2}
                  className="mt-3 w-full rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-sm"
                />
                {reviewError && <p className="mt-2 text-xs font-bold text-[var(--critical)]">{reviewError}</p>}
                <button
                  onClick={handleSubmitReview}
                  disabled={reviewSubmitting || reviewRating === 0}
                  className="mt-3 w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-2.5 disabled:opacity-60"
                >
                  {reviewSubmitting ? "Submitting…" : "Submit rating"}
                </button>
              </div>
            )}
            {reviewSubmitted && (
              <p className="text-xs font-bold text-[var(--success)] mb-6">Thanks — your rating was submitted.</p>
            )}

            {actionError && <p className="text-xs text-[var(--critical)] mb-3">{actionError}</p>}

            {isAssignedCollector && pickup.status === "ACCEPTED" && (
              <ActionButton label="Start Heading Over" acting={acting} onClick={() => runAction(() => api.pickupEnRoute(id))} />
            )}
            {isAssignedCollector && pickup.status === "EN_ROUTE" && (
              <ActionButton label="Mark Arrived" acting={acting} onClick={() => runAction(() => api.pickupArrive(id))} />
            )}
            {isAssignedCollector && pickup.status === "ARRIVED" && (
              <ActionButton label="Start Collecting" acting={acting} onClick={() => runAction(() => api.pickupStartCollecting(id))} />
            )}
            {isAssignedCollector && pickup.status === "COLLECTING" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAction(() => api.recordPickupWeight(id, { verifiedWeightKg: Number(weightInput), method: "platform_scale" }));
                }}
                className="flex flex-col gap-3 mb-2"
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-[var(--text-on-bg-2)]">Verified weight (kg)</span>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={acting}
                  className="rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3 disabled:opacity-60"
                >
                  {acting ? "Saving…" : "Record Weight"}
                </button>
              </form>
            )}
            {isAssignedCollector && pickup.status === "WEIGHED" && (
              <ActionButton label="Complete Pickup" acting={acting} onClick={handleComplete} />
            )}

            {(isProducer || isAssignedCollector) && cancellable && pickup.status !== "COLLECTING" && (
              <button
                onClick={() => runAction(() => api.cancelPickup(id))}
                disabled={acting}
                className="w-full rounded-full border border-[var(--border)] text-[var(--text-on-bg-2)] font-bold text-sm py-3 mb-6 disabled:opacity-60"
              >
                {acting ? "Cancelling…" : "Cancel Pickup"}
              </button>
            )}

            <h3 className="text-sm font-extrabold text-[var(--text-on-bg)] mb-3">History</h3>
            <div className="flex flex-col">
              {events.map((ev, i) => (
                <div key={ev.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--cyclo-teal)] mt-1.5" />
                    {i < events.length - 1 && <div className="w-px flex-1 bg-[var(--border)]" />}
                  </div>
                  <div className="pb-4">
                    <div className="text-sm font-bold text-[var(--text-on-bg)]">{EVENT_LABELS[ev.eventType] ?? ev.eventType}</div>
                    <div className="text-xs text-[var(--text-on-bg-2)]">{new Date(ev.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => router.back()} className="w-full rounded-full border border-[var(--border)] text-[var(--text-on-bg-2)] font-bold text-sm py-3 mt-2">
              Back
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function ActionButton({ label, acting, onClick }: { label: string; acting: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={acting}
      className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3 mb-2 disabled:opacity-60"
    >
      {acting ? "Working…" : label}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <span className="text-sm text-[var(--text-2)]">{k}</span>
      <span className="text-sm font-bold text-right">{v}</span>
    </div>
  );
}
