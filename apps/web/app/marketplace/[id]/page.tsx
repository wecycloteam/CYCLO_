"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle, ShoppingBag, Phone } from "lucide-react";
import { api, ApiError, CurrentUser, SellerContact, WasteListing, listingStatusLabel, formatUnitPrice, tokenStore } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n";
import { StarRatingDisplay } from "@/components/StarRating";
import { LoadingState, ErrorState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

// A listing is publicly viewable (§ landing/home redesign — a visitor can browse
// without an account); only owner actions and Contact Seller need one. Mirrors the
// same pattern used on the marketplace list page.
function useOptionalCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    api
      .me()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) tokenStore.clear();
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, checked };
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { user, checked } = useOptionalCurrentUser();
  const [listing, setListing] = useState<WasteListing | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState("");
  const [contact, setContact] = useState<SellerContact | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

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
    if (checked) Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, id]);

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

  async function handleShowContact() {
    if (contact) return;
    setContactLoading(true);
    setContactError(null);
    try {
      setContact(await api.contactSeller(id));
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : "Couldn't load the seller's contact info.");
    } finally {
      setContactLoading(false);
    }
  }

  async function handleMessageSeller() {
    setMessaging(true);
    setMessageError(null);
    try {
      const conversation = await api.startConversation({ listingId: id });
      router.push(`/chat/${conversation.id}`);
    } catch (err) {
      setMessageError(err instanceof ApiError ? err.message : "Couldn't start a conversation.");
    } finally {
      setMessaging(false);
    }
  }

  async function handleConfirmPurchase() {
    const quantity = Number(buyQuantity);
    if (!quantity || quantity <= 0) {
      setBuyError("Enter a quantity greater than 0.");
      return;
    }
    setBuying(true);
    setBuyError(null);
    try {
      const order = await api.createOrder(id, quantity);
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setBuyError(err instanceof ApiError ? err.message : "Couldn't start this purchase.");
    } finally {
      setBuying(false);
    }
  }

  const isOwner = user && listing && listing.sellerId === user.id;
  // household is "seller mode" in the self-service buyer/seller switch (see
  // profile page) — buying is blocked server-side for that role, so the button is
  // hidden rather than shown and then erroring.
  const canBuy = user && user.role !== "household";
  const pricePerKg = listing && listing.askingPrice != null ? listing.askingPrice / listing.estimatedWeightKg : 0;
  const quantityNum = Number(buyQuantity) || 0;
  const computedPrice = Math.round(pricePerKg * quantityNum);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      {user ? (
        <AppHeader title="Listing" />
      ) : (
        <header className="sticky top-0 z-10 bg-[var(--chrome-bg)] border-b border-[var(--chrome-border)]">
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4 px-6 py-3 md:max-w-xl lg:max-w-3xl">
            <Link href="/" aria-label="CYCLO home">
              <Image src="/brand/cyclo-logo-light.png" alt="CYCLO" width={120} height={34} className="cyclo-header-logo-light h-[34px] w-auto" />
              <Image src="/brand/cyclo-logo-dark.png" alt="CYCLO" width={120} height={34} className="cyclo-header-logo-dark h-[34px] w-auto" />
            </Link>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <Link
                href={`/login?redirect=${encodeURIComponent(`/marketplace/${id}`)}`}
                className="rounded-full bg-[var(--cyclo-teal)] px-4 py-2 text-sm font-bold text-white"
              >
                {t("Log in")}
              </Link>
            </div>
          </div>
        </header>
      )}
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label={t("Loading listing…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

        {state === "ready" && listing && (
          <>
            {listing.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto mb-4 -mx-6 px-6">
                {listing.photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
                  <img key={i} src={p} alt="" className="h-40 w-40 flex-shrink-0 object-cover rounded-[var(--r-lg)]" />
                ))}
              </div>
            )}

            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="text-lg font-extrabold text-[var(--text-on-bg)]">{t(listing.material.label)}</h1>
              <span
                className={`inline-block rounded-[var(--r-pill)] px-2.5 py-1 text-[11px] font-bold ${
                  listing.moderationStatus === "PENDING"
                    ? "bg-[#FFF3DC] text-[var(--warning)]"
                    : listing.moderationStatus === "REJECTED"
                      ? "bg-[#FCE3DE] text-[var(--critical)]"
                      : "bg-[#E4F7E2] text-[var(--success)]"
                }`}
              >
                {t(listingStatusLabel(listing))}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2 text-xs text-[var(--text-on-bg-2)]">
              <span>{listing.seller.name}</span>
              <VerifiedBadge status={listing.seller.verificationStatus} />
            </div>
            <div className="mb-2">
              <StarRatingDisplay average={listing.seller.rating?.average ?? 0} count={listing.seller.rating?.count ?? 0} seed={listing.seller.id} />
            </div>
            {listing.askingPrice != null && (
              <div className="mb-4">
                <div className="text-2xl font-extrabold text-[var(--cyclo-green)]">{formatUnitPrice(listing)}</div>
                <div className="text-xs text-[var(--text-on-bg-2)]">
                  TZS {listing.askingPrice.toLocaleString()} total for {listing.estimatedWeightKg} {listing.quantityUnit}
                </div>
              </div>
            )}

            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] mb-6">
              <Row k={t("Quantity")} v={`${listing.estimatedWeightKg} ${listing.quantityUnit}`} />
              {listing.verifiedWeightKg != null && <Row k={t("Verified weight")} v={`${listing.verifiedWeightKg} kg`} />}
              {listing.condition && <Row k={t("Condition")} v={listing.condition} />}
              <Row
                k={t("Location")}
                v={
                  [listing.location.addressLine, listing.location.district, listing.location.region]
                    .filter(Boolean)
                    .join(", ") || listing.location.label
                }
              />
              <Row k={t("Pickup")} v={t(listing.pickupOption.replace(/_/g, " "))} />
              <Row k={t("Listing status")} v={t(listing.status.replace(/_/g, " "))} />
            </div>

            {listing.description && <p className="text-sm text-[var(--text-on-bg-2)] mb-6">{listing.description}</p>}

            {!isOwner && user && (
              <div className="mb-4 flex flex-col gap-2">
                {listing.status === "ACTIVE" && listing.askingPrice != null && canBuy && !showBuyForm && (
                  <button
                    onClick={() => {
                      setShowBuyForm(true);
                      setBuyQuantity(String(listing.estimatedWeightKg));
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3"
                  >
                    <ShoppingBag size={16} />
                    {t("Buy Now")}
                  </button>
                )}

                {showBuyForm && (
                  <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <label className="mb-1 block text-xs font-bold text-[var(--text-2)]">
                      {t("How much do you want to buy? (max {max} {unit})")
                        .replace("{max}", String(listing.estimatedWeightKg))
                        .replace("{unit}", listing.quantityUnit)}
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max={listing.estimatedWeightKg}
                      step="0.1"
                      value={buyQuantity}
                      onChange={(e) => setBuyQuantity(e.target.value)}
                      className="mb-3 w-full rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2.5 text-sm"
                    />
                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span className="text-[var(--text-2)]">{t("Total price")}</span>
                      <span className="font-extrabold text-[var(--text-1)]">TZS {computedPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBuyForm(false)}
                        className="flex-1 rounded-full border border-[var(--border)] text-[var(--text-2)] font-bold text-sm py-2.5"
                      >
                        {t("Cancel")}
                      </button>
                      <button
                        onClick={handleConfirmPurchase}
                        disabled={buying}
                        className="flex-1 rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-2.5 disabled:opacity-60"
                      >
                        {buying ? t("Starting…") : t("Confirm Purchase")}
                      </button>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleMessageSeller}
                  disabled={messaging}
                  className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--cyclo-green)] text-[var(--cyclo-green)] font-bold text-sm py-2.5 disabled:opacity-60"
                >
                  <MessageCircle size={16} />
                  {messaging ? t("Opening chat…") : t("Message Seller")}
                </button>

                {!contact ? (
                  <button
                    onClick={handleShowContact}
                    disabled={contactLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] text-[var(--text-on-bg)] font-bold text-sm py-2.5 disabled:opacity-60"
                  >
                    <Phone size={16} />
                    {contactLoading ? t("Loading…") : t("Show Seller's Phone Number")}
                  </button>
                ) : contact.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-1)] font-bold text-sm py-2.5"
                  >
                    <Phone size={16} />
                    {contact.phone}
                  </a>
                ) : (
                  <p className="text-center text-xs text-[var(--text-on-bg-2)]">
                    {t("{name} hasn't added a phone number — use chat to reach them.").replace("{name}", contact.name)}
                  </p>
                )}
                {contactError && <p className="text-xs text-[var(--critical)]">{contactError}</p>}
                {messageError && <p className="text-xs text-[var(--critical)]">{messageError}</p>}
                {buyError && <p className="text-xs text-[var(--critical)]">{buyError}</p>}
              </div>
            )}

            {!isOwner && !user && (
              <Link
                href={`/login?redirect=${encodeURIComponent(`/marketplace/${id}`)}`}
                className="block w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3 text-center mb-4"
              >
                {t("Log in to Message Seller / Buy")}
              </Link>
            )}

            {actionError && <p className="text-xs text-[var(--critical)] mb-3">{actionError}</p>}

            {isOwner && listing.status === "DRAFT" && (
              <button
                onClick={handlePublish}
                disabled={acting}
                className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-3 mb-2 disabled:opacity-60"
              >
                {acting ? t("Publishing…") : t("Publish Listing")}
              </button>
            )}

            {isOwner && ["DRAFT", "ACTIVE"].includes(listing.status) && (
              <button
                onClick={handleCancel}
                disabled={acting}
                className="w-full rounded-full border border-[var(--border)] text-[var(--text-on-bg-2)] font-bold text-sm py-3 disabled:opacity-60"
              >
                {acting ? t("Cancelling…") : t("Cancel Listing")}
              </button>
            )}

            {!isOwner && (
              <button
                onClick={() => router.back()}
                className="w-full rounded-full border border-[var(--border)] text-[var(--text-on-bg-2)] font-bold text-sm py-3"
              >
                {t("Back")}
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
