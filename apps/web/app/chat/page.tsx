"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Conversation } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";

// No websocket/realtime infra exists in this app (see chat/[id]/page.tsx) — polling this
// list too, at the same interval as an open thread, so a new incoming message shows up
// (and moves that conversation to the top) without the user having to manually refresh.
const POLL_MS = 2000;

export default function ChatListPage() {
  const { t } = useLanguage();
  const { state: authState, user } = useCurrentUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  function load(initial: boolean) {
    if (initial) setState("loading");
    api
      .myConversations()
      .then((res) => {
        setConversations(res);
        setState("ready");
      })
      .catch((err) => {
        if (initial) {
          setError(err instanceof ApiError ? err.message : "We couldn't load your chats.");
          setState("error");
        }
      });
  }

  useEffect(() => {
    if (authState !== "ready") return;
    load(true);
    const interval = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(interval);
  }, [authState]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Chats" />
      <div className="flex-1 max-w-md w-full mx-auto px-5 py-6">
        {state === "loading" && <LoadingState label={t("Loading your chats…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={() => load(true)} />}

        {state === "ready" && conversations.length === 0 && (
          <EmptyState
            title={t("No conversations yet")}
            hint={t("Message a seller from a listing, or a buyer will message you once they're interested.")}
          />
        )}

        {state === "ready" && conversations.length > 0 && user && (
          <div className="flex flex-col gap-2">
            {conversations.map((c) => {
              const other = c.buyerId === user.id ? c.seller : c.buyer;
              return (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--cyclo-teal)] text-sm font-extrabold text-white">
                    {other.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
                      <img src={other.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      other.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-extrabold text-[var(--text-1)]">{other.name}</span>
                      {c.unreadCount != null && c.unreadCount > 0 && (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[var(--cyclo-green)] px-1.5 text-[10px] font-extrabold text-[#0E2A1F]">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    {c.listing && <div className="truncate text-[11px] text-[var(--text-3)]">{t("Re:")} {c.listing.material.label}</div>}
                    <div className="truncate text-xs text-[var(--text-2)]">
                      {c.lastMessage ? c.lastMessage.body : <span className="italic text-[var(--text-3)]">{t("No messages yet")}</span>}
                    </div>
                  </div>
                  <MessageCircle size={16} className="shrink-0 text-[var(--text-3)]" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}
