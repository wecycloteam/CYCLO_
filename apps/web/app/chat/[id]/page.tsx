"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Trash2, Smile, Image as ImageIcon, Mic, Square, Check, CheckCheck, Flag } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, ChatMessageRecord, Conversation } from "@/lib/api";
import { resizeImageFile } from "@/lib/resizeImage";
import { LoadingState, ErrorState } from "@/components/AsyncState";
import { useLanguage } from "@/lib/i18n";

type LoadState = "loading" | "ready" | "error";

const QUICK_EMOJI = ["😀", "😂", "👍", "🙏", "❤️", "😍", "😢", "🔥", "👋", "🎉"];

// No websocket/realtime infra exists in this app (Netlify's serverless functions can't
// hold a persistent connection open the way a WebSocket server or a service like Pusher/
// Ably/Supabase Realtime would) — polling every 2s while the thread is open is the honest,
// simple version of "live" chat: fast enough to feel responsive, not a fake instant-looking
// UI backed by nothing. Same tradeoff as AssistantChat's request/response pattern.
const POLL_MS = 2000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// WhatsApp-style delivery ticks — only ever rendered for a message the current user sent
// (m.status is null for the other participant's own messages, see ChatService.getMessages).
function MessageTicks({ status }: { status?: "sent" | "delivered" | "read" | null }) {
  if (!status) return null;
  if (status === "read") return <CheckCheck size={14} className="text-[#53BDEB]" />;
  if (status === "delivered") return <CheckCheck size={14} className="opacity-70" />;
  return <Check size={14} className="opacity-70" />;
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { state: authState, user } = useCurrentUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Deletions applied locally, re-applied to every poll result — otherwise a poll that was
  // already in flight when the user deleted would briefly bring the message back.
  const hiddenIdsRef = useRef<Set<string>>(new Set());
  const deletedForEveryoneIdsRef = useRef<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function applyLocalDeletes(list: ChatMessageRecord[]) {
    return list
      .filter((m) => !hiddenIdsRef.current.has(m.id))
      .map((m) =>
        deletedForEveryoneIdsRef.current.has(m.id) ? { ...m, deletedForEveryone: true, body: "This message was deleted" } : m
      );
  }

  function startLongPress(messageId: string) {
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setOpenMenuId(messageId);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    }, 450);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

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
        setMessages(applyLocalDeletes(msgs));
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

  async function sendPayload(body: string, attachmentUrl?: string, attachmentType?: "image" | "audio") {
    if (!user) return;
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessageRecord = {
      id: tempId,
      conversationId: id,
      senderId: user.id,
      body,
      attachmentUrl,
      attachmentType,
      createdAt: new Date().toISOString(),
      readAt: null,
      deletedForEveryone: false,
      status: "sent",
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      await api.sendChatMessage(id, body, attachmentUrl, attachmentType);
      load(false);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setAttachError(err instanceof ApiError ? err.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setShowEmoji(false);
    await sendPayload(text);
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAttachError(null);
    try {
      const dataUrl = await resizeImageFile(file);
      await sendPayload("", dataUrl, "image");
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Couldn't attach that photo.");
    }
  }

  async function handleStartRecording() {
    setAttachError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setAttachError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => sendPayload("", reader.result as string, "audio");
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setAttachError("Couldn't access your microphone (blocked or unavailable).");
    }
  }

  function handleStopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  const other = conversation && user ? (conversation.buyerId === user.id ? conversation.seller : conversation.buyer) : null;

  async function handleDeleteForMe(messageId: string) {
    setOpenMenuId(null);
    hiddenIdsRef.current.add(messageId);
    setMessages((prev) => applyLocalDeletes(prev));
    try {
      await api.deleteMessageForMe(messageId);
    } catch {
      hiddenIdsRef.current.delete(messageId);
      setAttachError(t("Couldn't delete that message."));
      load(false);
    }
  }

  async function handleDeleteForEveryone(messageId: string) {
    setOpenMenuId(null);
    deletedForEveryoneIdsRef.current.add(messageId);
    setMessages((prev) => applyLocalDeletes(prev));
    try {
      await api.deleteMessageForEveryone(messageId);
    } catch {
      deletedForEveryoneIdsRef.current.delete(messageId);
      setAttachError(t("Couldn't delete that message."));
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
              {t("Re:")} {t(conversation.listing.material.label)}
            </Link>
          )}
        </div>
        {other && (
          <Link
            href={`/report?category=CHAT&reportedUserId=${other.id}&reportedUsername=${encodeURIComponent(other.name)}&relatedConversationId=${id}&context=CHAT`}
            aria-label={t("Report conversation")}
            className="shrink-0 text-[var(--chrome-text-muted)]"
          >
            <Flag size={18} />
          </Link>
        )}
      </header>

      {state !== "ready" && (
        <div className="mx-auto w-full max-w-md flex-1 px-4 py-4">
          {state === "loading" && <LoadingState label={t("Loading conversation…")} />}
          {state === "error" && <ErrorState message={error ?? t("Something went wrong.")} onRetry={() => load(true)} />}
        </div>
      )}

      {state === "ready" && user && (
        <>
          {openMenuId && <div className="fixed inset-0 z-[5]" onClick={() => setOpenMenuId(null)} aria-hidden="true" />}
          <div ref={listRef} className="mx-auto w-full max-w-md flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {messages.length === 0 && (
              <p className="py-8 text-center text-xs text-[var(--text-on-bg-2)]">
                {t("Say hello — start the conversation about this listing.")}
              </p>
            )}
            {messages.map((m) => {
              const isMine = m.senderId === user.id;
              const isDeleted = m.deletedForEveryone;
              const canOpenMenu = !isDeleted && !m.id.startsWith("temp-");
              return (
                <div key={m.id} className={`relative max-w-[80%] ${isMine ? "ml-auto" : ""}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    onPointerDown={() => canOpenMenu && startLongPress(m.id)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onClick={() => openMenuId && openMenuId !== m.id && setOpenMenuId(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (canOpenMenu) setOpenMenuId(m.id);
                    }}
                    style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
                    className={`w-full rounded-[var(--r-md)] px-3 py-2 text-left text-sm ${
                      isMine ? "bg-[var(--cyclo-teal)] text-white" : "bg-[var(--surface)] text-[var(--text-1)]"
                    } ${isDeleted ? "italic opacity-70" : ""}`}
                  >
                    {isDeleted ? (
                      t(m.body)
                    ) : (
                      <>
                        {m.attachmentType === "image" && m.attachmentUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
                          <img src={m.attachmentUrl} alt="" className="mb-1.5 max-h-56 w-full rounded-[var(--r-sm)] object-cover" />
                        )}
                        {m.attachmentType === "audio" && m.attachmentUrl && (
                          <audio controls src={m.attachmentUrl} className="mb-1 h-9 w-full max-w-[220px]" />
                        )}
                        {m.body && <span>{m.body}</span>}
                      </>
                    )}
                    <div
                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                        isMine ? "text-white/70" : "text-[var(--text-3)]"
                      }`}
                    >
                      <span>{formatTime(m.createdAt)}</span>
                      {isMine && !isDeleted && <MessageTicks status={m.status} />}
                    </div>
                  </div>

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
                        <Trash2 size={14} /> {t("Delete for me")}
                      </button>
                      {isMine && (
                        <button
                          type="button"
                          onClick={() => handleDeleteForEveryone(m.id)}
                          className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-left text-xs font-bold text-[var(--critical)] hover:bg-[var(--surface-2)]"
                        >
                          <Trash2 size={14} /> {t("Delete for everyone")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 border-t border-[var(--chrome-border)] bg-[var(--chrome-bg)]">
            {attachError && <p className="px-3 pt-2 text-xs font-bold text-[var(--critical)]">{attachError}</p>}
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

            {recording ? (
              <div className="flex items-center gap-3 p-3">
                <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[var(--critical)]" />
                <span className="flex-1 text-sm font-bold text-[var(--chrome-text)]">
                  {t("Recording…")} {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:{String(recordSeconds % 60).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  aria-label={t("Stop and send")}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F]"
                >
                  <Square size={16} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSend} className="flex items-center gap-1.5 p-3">
                <button
                  type="button"
                  onClick={() => setShowEmoji((v) => !v)}
                  aria-label="Emoji"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--chrome-text)]"
                >
                  <Smile size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  aria-label={t("Attach photo")}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--chrome-text)]"
                >
                  <ImageIcon size={20} />
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("Type a message…")}
                  className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text-1)] outline-none"
                />
                {input.trim() ? (
                  <button
                    type="submit"
                    disabled={sending}
                    aria-label="Send"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] disabled:opacity-50"
                  >
                    <Send size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    aria-label={t("Record voice note")}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--cyclo-green)] text-[#0E2A1F] disabled:opacity-50"
                  >
                    <Mic size={16} />
                  </button>
                )}
              </form>
            )}
          </div>
        </>
      )}
    </main>
  );
}
