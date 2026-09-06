"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AssistantIcon } from "./AssistantIcon";
import { X, Send, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface EvidenceItem {
  type: "workflow" | "run";
  id: string;
  label: string;
  href: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  evidence?: EvidenceItem[];
}

const DEFAULT_SUGGESTIONS = [
  "Why did my last run fail?",
  "Which plan fits my usage?",
  "How do credits work?",
  "Help me design a workflow for new signups",
];

// Page-aware suggested prompts (Master Spec section 4): the first prompt the person
// sees changes based on where they already are, instead of one static list everywhere.
const PATH_SUGGESTIONS: Array<{ prefix: string; suggestions: string[] }> = [
  { prefix: "/workflows/", suggestions: ["What does this workflow do, step by step?", "How can I make this workflow more reliable?", "What would happen if I add an approval step here?"] },
  { prefix: "/workflows", suggestions: ["Which of my workflows fails most often?", "Help me design a new workflow", "What's the difference between a draft and a published workflow?"] },
  { prefix: "/runs", suggestions: ["Why did my last run fail?", "Which workflow has the worst success rate?", "Explain what a run's timeline shows"] },
  { prefix: "/settings", suggestions: ["What does the Manager role allow?", "How do I add a teammate?", "What's the difference between Admin and Owner?"] },
  { prefix: "/growth-engine", suggestions: ["Summarize my current growth plans", "What's a good first growth experiment to try?"] },
  { prefix: "/ai-studio", suggestions: ["Why did a provider fail over?", "How is AI cost estimated?", "What happens when every provider is rate-limited?"] },
];

function suggestionsFor(pathname: string): string[] {
  const match = PATH_SUGGESTIONS.find((p) => pathname.startsWith(p.prefix));
  return match?.suggestions ?? DEFAULT_SUGGESTIONS;
}

const STORAGE_KEY = "busigo-assistant-history";
const WELCOME: ChatMessage = {
  role: "assistant",
  content: "Hi! I'm the busigo Assistant. I can see your plan, workflows, and recent runs — ask me anything about your account, or how to build something.",
};

function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [WELCOME];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [WELCOME];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

export function ChatWidget() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Runs once on mount, client-side only — restores any prior conversation for this browser.
  // (Per-account history in the database would require a new table; this is the lighter-weight
  // version, scoped to "survives a reload," not "syncs across devices.")
  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  useEffect(() => {
    if (messages.length <= 1) return; // don't persist just the welcome message
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // Storage full or blocked — conversation still works, just won't survive a reload.
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      let evidence: EvidenceItem[] = [];
      const evidenceHeader = res.headers.get("X-Copilot-Evidence");
      if (evidenceHeader) {
        try {
          evidence = JSON.parse(decodeURIComponent(evidenceHeader));
        } catch {
          // Missing/malformed evidence header — the reply still works, just without citation chips.
        }
      }

      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + chunk, evidence };
          return copy;
        });
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Sorry — I couldn't reach the assistant just now." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open busigo assistant"}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-panel shadow-lg ring-1 ring-hairline",
          "transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95"
        )}
      >
        {open ? <X size={22} className="text-ink" /> : <AssistantIcon size={30} />}
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-24 right-5 z-40 flex w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-lg border border-hairline bg-panel shadow-2xl transition-all duration-300 ease-out",
          open ? "h-[32rem] max-h-[calc(100vh-8rem)] translate-y-0 opacity-100" : "pointer-events-none h-0 translate-y-4 opacity-0"
        )}
      >
        <div className="flex items-center gap-2 border-b border-hairline bg-surface px-4 py-3">
          <AssistantIcon size={22} />
          <div className="flex-1">
            <p className="text-sm font-bold text-ink">busigo Assistant</p>
            <p className="text-xs text-slate">Knows your workflows &amp; usage</p>
          </div>
          {messages.length > 1 && (
            <button
              onClick={() => {
                setMessages([WELCOME]);
                try {
                  localStorage.removeItem(STORAGE_KEY);
                } catch {
                  // non-fatal
                }
              }}
              className="text-xs text-slate transition-colors hover:text-danger-ink"
            >
              Clear
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed animate-[fadeIn_.2s_ease]",
                  m.role === "user" ? "bg-signal-strong text-white" : "bg-surface text-ink"
                )}
              >
                {m.content || (streaming && i === messages.length - 1 ? <TypingDots /> : "")}
              </div>
              {m.role === "assistant" && !!m.evidence?.length && !(streaming && i === messages.length - 1) && (
                <div className="mt-1 flex max-w-[85%] flex-wrap gap-1">
                  {m.evidence.map((e) => (
                    <Link
                      key={`${e.type}-${e.id}`}
                      href={e.href}
                      className="inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[11px] text-slate transition-colors hover:border-signal hover:text-signal"
                    >
                      {e.label} <ExternalLink size={10} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {messages.length === 1 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {suggestionsFor(pathname).map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-hairline px-2.5 py-1 text-xs text-slate transition-colors hover:border-signal hover:text-signal"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-hairline p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your workflows..."
            className="flex-1 rounded border border-hairline px-3 py-2 text-sm outline-none focus:border-signal focus:ring-1 focus:ring-signal"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-signal-strong text-white transition-colors hover:bg-signal-dark disabled:opacity-40"
            aria-label="Send"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-slate">
      <Sparkles size={13} className="animate-pulse" />
      <span className="animate-pulse">thinking...</span>
    </span>
  );
}

