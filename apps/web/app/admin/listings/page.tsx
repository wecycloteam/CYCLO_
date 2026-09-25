"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Scale, ChevronDown, ChevronUp, MessageCircle, ImageIcon } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, AdminPendingListing } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { AdminGate } from "@/components/AdminGate";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";

function SellerIdentity({ seller }: { seller: AdminPendingListing["seller"] }) {
  const { t } = useLanguage();
  const org = seller.organizationMemberships[0]?.organization;
  return (
    <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] p-3 mb-3 text-xs">
      <div className="font-extrabold text-sm mb-1">{seller.name}</div>
      <div className="text-[var(--text-2)]">
        {seller.phone} · {seller.role}
      </div>
      {seller.collectorProfile && (
        <div className="text-[var(--text-2)]">{t("Collector verification:")} {t(seller.collectorProfile.verificationStatus)}</div>
      )}
      {org && (
        <div className="text-[var(--text-2)]">
          {org.name} ({org.type}) — {t(org.verificationStatus)}
        </div>
      )}
    </div>
  );
}

export default function AdminListingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { state: authState, user } = useCurrentUser();
  const [listings, setListings] = useState<AdminPendingListing[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [startingChatId, setStartingChatId] = useState<string | null>(null);

  function load() {
    setState("loading");
    api
      .adminPendingListings()
      .then((res) => {
        setListings(res);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t("We couldn't load pending listings."));
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
      setActionError(err instanceof ApiError ? err.message : t("Couldn't approve this listing."));
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
      setActionError(err instanceof ApiError ? err.message : t("Couldn't reject this listing."));
    } finally {
      setActingId(null);
    }
  }

  async function handleRequestChanges(id: string) {
    const advice = (reasonDrafts[id] ?? "").trim();
    if (!advice) {
      setActionError(t("Write what should change before sending it to the seller."));
      return;
    }
    setActingId(id);
    setActionError(null);
    try {
      await api.adminRequestListingChanges(id, advice);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("Couldn't send those changes to the seller."));
    } finally {
      setActingId(null);
    }
  }

  async function handleChat(sellerId: string) {
    setStartingChatId(sellerId);
    setActionError(null);
    try {
      const conversation = await api.startConversation({ sellerId });
      router.push(`/chat/${conversation.id}`);
    } catch {
      setActionError(t("Couldn't open the chat."));
    } finally {
      setStartingChatId(null);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Pending Listings" back />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        <AdminGate authState={authState} user={user}>
          {state === "loading" && <LoadingState label={t("Loading pending listings…")} />}
          {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

          {state === "ready" && listings.length === 0 && (
            <EmptyState title={t("Nothing pending review")} hint={t("Newly published listings will show up here for approval.")} />
          )}

          {actionError && <p className="text-xs text-[var(--critical)] mb-3">{actionError}</p>}

          {state === "ready" && listings.length > 0 && (
            <div className="flex flex-col gap-3">
              {listings.map((listing) => {
                const expanded = expandedId === listing.id;
                const thumbnail = listing.photos?.[0];
                return (
                  <div key={listing.id} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                    <button
                      onClick={() => setExpandedId(expanded ? null : listing.id)}
                      className="flex w-full items-center gap-3 p-4 text-left"
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[var(--r-sm)] bg-[var(--surface-2)]">
                        {thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element -- may be a base64 data URL
                          <img src={thumbnail} alt="" className="h-11 w-11 object-cover" />
                        ) : (
                          <ImageIcon size={16} className="text-[var(--text-on-bg-2)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-extrabold">{t(listing.material.label)}</span>
                          {listing.askingPrice != null && (
                            <span className="shrink-0 text-sm font-extrabold text-[var(--cyclo-teal)]">
                              TZS {listing.askingPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-[var(--text-2)]">{listing.seller.name}</div>
                      </div>
                      {expanded ? <ChevronUp size={18} className="shrink-0 text-[var(--text-2)]" /> : <ChevronDown size={18} className="shrink-0 text-[var(--text-2)]" />}
                    </button>

                    {expanded && (
                      <div className="border-t border-[var(--border)] p-4">
                        <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-2)] mb-3">
                          <MapPin size={12} className="inline" /> {listing.location.region ?? listing.location.label} ·{" "}
                          <Scale size={12} className="inline" /> {listing.estimatedWeightKg} kg · {t("submitted")}{" "}
                          {new Date(listing.createdAt).toLocaleDateString()}
                        </div>

                        {listing.photos && listing.photos.length > 0 && (
                          <div className="mb-3 grid grid-cols-4 gap-2">
                            {listing.photos.map((p, i) => (
                              // eslint-disable-next-line @next/next/no-img-element -- may be a base64 data URL
                              <img key={i} src={p} alt="" className="aspect-square w-full rounded-[var(--r-sm)] object-cover" />
                            ))}
                          </div>
                        )}

                        <SellerIdentity seller={listing.seller} />

                        {listing.condition && <p className="text-xs font-bold text-[var(--text-1)] mb-1">{t("Condition:")} {listing.condition}</p>}
                        {listing.description && <p className="text-xs text-[var(--text-2)] mb-3">{listing.description}</p>}

                        <button
                          onClick={() => handleChat(listing.seller.id)}
                          disabled={startingChatId === listing.seller.id}
                          className="mb-3 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--cyclo-teal)] text-[var(--cyclo-teal)] font-bold text-xs py-2.5 disabled:opacity-60"
                        >
                          <MessageCircle size={14} />
                          {startingChatId === listing.seller.id ? t("Opening chat…") : t("Chat with {name}").replace("{name}", listing.seller.name)}
                        </button>

                        <textarea
                          placeholder={t("Reason to reject, or advice for changes needed (price, photos, etc.)")}
                          value={reasonDrafts[listing.id] ?? ""}
                          onChange={(e) => setReasonDrafts((prev) => ({ ...prev, [listing.id]: e.target.value }))}
                          rows={2}
                          className="w-full resize-none rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2 text-xs mb-3"
                        />

                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleApprove(listing.id)}
                            disabled={actingId === listing.id}
                            className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-xs py-2.5 disabled:opacity-60"
                          >
                            {t("Approve")}
                          </button>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRequestChanges(listing.id)}
                              disabled={actingId === listing.id}
                              className="flex-1 rounded-full border border-[var(--warning)] text-[var(--warning)] font-bold text-xs py-2.5 disabled:opacity-60"
                            >
                              {t("Request Changes")}
                            </button>
                            <button
                              onClick={() => handleReject(listing.id)}
                              disabled={actingId === listing.id}
                              className="flex-1 rounded-full border border-[var(--critical)] text-[var(--critical)] font-bold text-xs py-2.5 disabled:opacity-60"
                            >
                              {t("Reject")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </AdminGate>
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
