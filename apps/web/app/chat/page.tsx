"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Image as ImageIcon, Mic, MoreVertical, Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Conversation } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";
type Tab = "chats" | "archived";

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
  const [tab, setTab] = useState<Tab>("chats");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  async function handleArchiveToggle(id: string, archived: boolean) {
    setOpenMenuId(null);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, archived } : c)));
    try {
      await api.archiveConversation(id, archived);
    } catch {
      load(false);
    }
  }

  async function handleConfirmDelete(id: string) {
    setConfirmDeleteId(null);
    setOpenMenuId(null);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    try {
      await api.deleteConversation(id);
    } catch {
      load(false);
    }
  }

  const visibleConversations = conversations.filter((c) => (tab === "archived" ? c.archived : !c.archived));
  const archivedCount = conversations.filter((c) => c.archived).length;

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Chats" />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-5 py-6">
        {archivedCount > 0 && (
          <div className="mb-4 flex rounded-[var(--r-pill)] border border-[var(--border)] p-1">
            <button
              onClick={() => setTab("chats")}
              className={`flex-1 rounded-[var(--r-pill)] py-1.5 text-xs font-bold ${
                tab === "chats" ? "bg-[var(--cyclo-teal)] text-white" : "text-[var(--text-on-bg-2)]"
              }`}
            >
              {t("Chats")}
            </button>
            <button
              onClick={() => setTab("archived")}
              className={`flex-1 rounded-[var(--r-pill)] py-1.5 text-xs font-bold ${
                tab === "archived" ? "bg-[var(--cyclo-teal)] text-white" : "text-[var(--text-on-bg-2)]"
              }`}
            >
              {t("Archived")} ({archivedCount})
            </button>
          </div>
        )}

        {state === "loading" && <LoadingState label={t("Loading your chats…")} />}
        {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={() => load(true)} />}

        {state === "ready" && visibleConversations.length === 0 && (
          <EmptyState
            title={tab === "archived" ? t("No archived chats") : t("No conversations yet")}
            hint={tab === "archived" ? undefined : t("Message a seller from a listing, or a buyer will message you once they're interested.")}
          />
        )}

        {state === "ready" && visibleConversations.length > 0 && user && (
          <div className="flex flex-col gap-2">
            {visibleConversations.map((c) => {
              const other = c.buyerId === user.id ? c.seller : c.buyer;
              return (
                <div key={c.id} className="relative flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <Link href={`/chat/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
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
                      {c.listing && <div className="truncate text-[11px] text-[var(--text-3)]">{t("Re:")} {t(c.listing.material.label)}</div>}
                      <div className="truncate text-xs text-[var(--text-2)]">
                        {c.lastMessage ? (
                          c.lastMessage.body || (
                            <span className="inline-flex items-center gap-1">
                              {c.lastMessage.attachmentType === "image" ? (
                                <ImageIcon size={12} />
                              ) : c.lastMessage.attachmentType === "audio" ? (
                                <Mic size={12} />
                              ) : null}
                              {c.lastMessage.attachmentType === "image"
                                ? t("Photo")
                                : c.lastMessage.attachmentType === "audio"
                                  ? t("Voice note")
                                  : ""}
                            </span>
                          )
                        ) : (
                          <span className="italic text-[var(--text-3)]">{t("No messages yet")}</span>
                        )}
                      </div>
                    </div>
                    <MessageCircle size={16} className="shrink-0 text-[var(--text-3)]" />
                  </Link>

                  <button
                    onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                    aria-label={t("More options")}
                    className="shrink-0 p-1 text-[var(--text-2)]"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {openMenuId === c.id && (
                    <div className="absolute right-2 top-12 z-10 flex flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
                      <button
                        onClick={() => handleArchiveToggle(c.id, !c.archived)}
                        className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-left text-xs font-bold text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                      >
                        {c.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                        {c.archived ? t("Unarchive") : t("Archive")}
                      </button>
                      <button
                        onClick={() => {
                          setOpenMenuId(null);
                          setConfirmDeleteId(c.id);
                        }}
                        className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-left text-xs font-bold text-[var(--critical)] hover:bg-[var(--surface-2)]"
                      >
                        <Trash2 size={14} /> {t("Delete chat")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-sm rounded-[var(--r-lg)] bg-[var(--surface)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[var(--text-1)]">{t("Delete this chat?")}</h2>
              <button onClick={() => setConfirmDeleteId(null)} aria-label={t("Cancel")} className="text-[var(--text-2)]">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-xs text-[var(--text-2)]">
              {t("This removes the conversation from your chat list. The other person can still see their copy.")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-full border border-[var(--border)] text-[var(--text-2)] font-bold text-sm py-2.5"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={() => handleConfirmDelete(confirmDeleteId)}
                className="flex-1 rounded-full bg-[var(--critical)] text-white font-bold text-sm py-2.5"
              >
                {t("Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {user && <BottomNav role={user.role} />}
    </main>
  );
}
