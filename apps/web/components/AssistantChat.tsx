"use client";

import { useRef, useState } from "react";
import { api, ApiError, ChatMessage } from "@/lib/api";

interface DisplayMessage extends ChatMessage {
  error?: boolean;
}

// Floating Cyclo Assistant — a real Gemini-backed chat (POST /ai/chat) for recycling
// sorting/pricing questions, not a decorative widget. Kept self-contained so it can be
// dropped onto any authenticated page without touching that page's own state.
export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const history = messages.filter((m) => !m.error).map(({ role, parts }) => ({ role, parts }));
    const nextMessages: DisplayMessage[] = [...messages, { role: "user", parts: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    scrollToBottom();

    try {
      const res = await api.chatWithAssistant(text, history);
      setMessages((prev) => [...prev, { role: "model", parts: res.reply }]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't reach the assistant. Please try again.";
      setMessages((prev) => [...prev, { role: "model", parts: message, error: true }]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Cyclo Assistant" : "Open Cyclo Assistant"}
        className="fixed bottom-20 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-[var(--cyclo-teal)] text-2xl text-white shadow-[0_10px_24px_rgba(0,0,0,.2)]"
      >
        {open ? "✕" : "🤖"}
      </button>

      {open && (
        <div className="fixed bottom-36 right-5 z-20 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <div className="text-sm font-extrabold">Cyclo Assistant</div>
            <div className="text-[11px] text-[var(--text-2)]">Ask about sorting, cleaning or pricing recyclables</div>
          </div>

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-xs text-[var(--text-2)]">
                Try: &ldquo;How do I prepare PET bottles for sale?&rdquo; or &ldquo;What&rsquo;s the going rate for aluminium cans?&rdquo;
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-[var(--r-md)] px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-[var(--cyclo-teal)] text-white"
                    : m.error
                      ? "bg-[var(--critical)]/10 text-[var(--critical)]"
                      : "bg-[var(--bg)] text-[var(--text-1)]"
                }`}
              >
                {m.parts}
              </div>
            ))}
            {sending && <div className="max-w-[85%] rounded-[var(--r-md)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-2)]">Thinking…</div>}
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-[var(--border)] p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Cyclo Assistant…"
              className="flex-1 rounded-full border border-[var(--border)] px-4 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-full bg-[var(--cyclo-teal)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
