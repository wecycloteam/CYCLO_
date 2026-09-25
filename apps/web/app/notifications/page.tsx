"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle2, XCircle, ShoppingBag, Wallet, PartyPopper, type LucideIcon } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Notification } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";

const TYPE_ICON: Record<string, LucideIcon> = {
  LISTING_PENDING: Clock,
  LISTING_APPROVED: CheckCircle2,
  LISTING_REJECTED: XCircle,
  ORDER_PLACED: ShoppingBag,
  PAYMENT_SUBMITTED: Wallet,
  PAYMENT_CONFIRMED_BUYER: PartyPopper,
  PAYMENT_CONFIRMED_SELLER: PartyPopper,
};

function timeAgo(iso: string, t: (s: string) => string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t("Just now");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${t("m ago")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t("h ago")}`;
  const days = Math.floor(hours / 24);
  return `${days}${t("d ago")}`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { state: authState, user } = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  function load() {
    setState("loading");
    api
      .myNotifications()
      .then((res) => {
        setNotifications(res);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t("We couldn't load your notifications."));
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  async function handleOpen(n: Notification) {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      api.markNotificationRead(n.id).catch(() => undefined);
    }
    if (n.link) router.push(n.link);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api.markAllNotificationsRead().catch(() => undefined);
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Notifications" back />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label={t("Loading notifications…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={load} />}

        {state === "ready" && notifications.length === 0 && (
          <EmptyState title={t("No notifications yet")} hint={t("Updates about your listings and orders will show up here.")} />
        )}

        {state === "ready" && notifications.length > 0 && (
          <>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="mb-3 self-end text-xs font-bold text-[var(--cyclo-teal)]">
                {t("Mark all as read")}
              </button>
            )}
            <div className="flex flex-col gap-2">
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Clock;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleOpen(n)}
                    className={`flex items-start gap-3 rounded-[var(--r-md)] border p-4 text-left ${
                      n.read ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--cyclo-teal)]/40 bg-[var(--surface-2)]"
                    }`}
                  >
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--cyclo-teal)]/10 text-[var(--cyclo-teal)]">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-[var(--text-1)]">{n.title}</span>
                        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--critical)]" />}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-2)]">{n.body}</p>
                      <span className="mt-1 block text-[11px] text-[var(--text-on-bg-2)]">{timeAgo(n.createdAt, t)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
