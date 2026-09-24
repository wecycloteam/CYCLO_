"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Trash2, Smile } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, ChatMessageRecord, Conversation } from "@/lib/api";
import { LoadingState, ErrorState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

const QUICK_EMOJI = ["😀", "😂", "👍", "🙏", "❤️", "😍", "😢", "🔥", "👋", "🎉"];

// No websocket/realtime infra exists in this app (Netlify's serverless functions can't
// hold a persistent connection open the way a WebSocket server or a service like Pusher/
// Ably/Supabase Realtime would) — polling every 2s while the thread is open is the honest,
// simple version of "live" chat: fast enough to feel responsive, not a fake instant-looking
// UI backed by nothing. Same tradeoff as AssistantChat's request/response pattern.
const POLL_MS = 2000;

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state: authState, user } = useCurrentUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === id) ?? null;

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function load(initial: boolean) {
    if (initial) setState("loading");
    Promise.all([api.myConversations(), api.conversationMessages(id)])
      .then(([convos, msgs]) => {
        setConversations(convos);
        setMessages(msgs);
        setState("ready");
        if (initial) {
          api.markConversationRead(id).catch(() => undefined);
          scrollToBottom();
        }
      })
      .catch((err) => {
        if (initial) {
          setError(err instanceof ApiError ? err.message : "We couldn't load this conversation.");
          setState("error");
        }
      });
  }

  useEffect(() => {
    if (authState !== "ready") return;
    load(true);
    const interval = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, id]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || !user) return;
    setSending(true);
    setInput("");
    setShowEmoji(false);

    // Optimistic append — shows the message the instant it's sent instead of waiting for
    // the next poll cycle to reflect it back. A temporary id/timestamp is replaced wholesale
    // by the next successful load(), which returns the real persisted row.
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessageRecord = {
      id: tempId,
      conversationId: id,
      senderId: user.id,
      body: text,
      createdAt: new Date().toISOString(),
      readAt: null,
      deletedForEveryone: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      await api.sendChatMessage(id, text);
      load(false);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  const other = conversation && user ? (conversation.buyerId === user.id ? conversation.seller : conversation.buyer) : null;

  async function handleDeleteForMe(messageId: string) {
    setOpenMenuId(null);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      await api.deleteMessageForMe(messageId);
    } catch {
      load(false);
    }
  }

  async function handleDeleteForEveryone(messageId: string) {
    setOpenMenuId(null);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deletedForEveryone: true, body: "This message was deleted" } : m)));
    try {
      await api.deleteMessageForEveryone(messageId);
    } catch {
      load(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-4 py-3">
        <button onClick={() => router.push("/chat")} aria-label="Back to chats" className="text-[var(--chrome-text)]">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold text-[var(--chrome-text)]">{other?.name ?? "Chat"}</div>
          {conversation?.listing && (
            <Link href={`/marketplace/${conversation.listingId}`} className="truncate text-[11px] text-[var(--chrome-text-muted)]">
              Re: {conversation.listing.material.label}
            </Link>
          )}
        </div>
      </header>

      {state !== "ready" && (
        <div className="mx-auto w-full max-w-md flex-1 px-4 py-4">
          {state === "loading" && <LoadingState label="Loading conversation…" />}
          {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={() => load(true)} />}
        </div>
      )}

      {state === "ready" && user && (
        <>
          <div ref={listRef} className="mx-auto w-full max-w-md flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {messages.length === 0 && (
              <p className="py-8 text-center text-xs text-[var(--text-on-bg-2)]">
                Say hello — start the conversation about this listing.
              </p>
            )}
            {messages.map((m) => {
              const isMine = m.senderId === user.id;
              const isDeleted = m.deletedForEveryone;
              return (
                <div key={m.id} className={`relative max-w-[80%] ${isMine ? "ml-auto" : ""}`}>
                  <button
                    type="button"
                    onClick={() => !isDeleted && setOpenMenuId(openMenuId === m.id ? null : m.id)}
                    className={`w-full rounded-[var(--r-md)] px-3 py-2 text-left text-sm ${
                      isMine ? "bg-[var(--cyclo-teal)] text-white" : "bg-[var(--surface)] text-[var(--text-1)]"
                    } ${isDeleted ? "italic opacity-70" : ""}`}
                  >
                    {m.body}
                  </button>

                  {openMenuId === m.id && !isDeleted && (
                    <div
                      className={`absolute top-full z-10 mt-1 flex flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] shadow-lg ${
                        isMine ? "right-0" : "left-0"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteForMe(m.id)}
                        className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-left text-xs font-bold text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                      >
                        <Trash2 size={14} /> Delete for me
                      </button>
                      {isMine && (
                        <button
                          type="button"
                          onClick={() => handleDeleteForEveryone(m.id)}
                          className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-left text-xs font-bold text-[var(--critical)] hover:bg-[var(--surface-2)]"
                        >
                          <Trash2 size={14} /> Delete for everyone
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 border-t border-[var(--chrome-border)] bg-[var(--chrome-bg)]">
            {showEmoji && (
              <div className="flex flex-wrap gap-1 border-b border-[var(--chrome-border)] px-3 py-2">
                {QUICK_EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setInput((prev) => prev + e)}
                    className="grid h-9 w-9 place-items-center rounded-[var(--r-md)] text-lg hover:bg-white/10"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleSend} className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                aria-label="Emoji"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--chrome-text)]"
              >
                <Smile size={20} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text-1)] outline-none"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </>
      )}
    </main>
  );
}
