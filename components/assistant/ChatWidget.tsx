"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, Send, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { AssistantIcon } from "./AssistantIcon";
import { Button, IconButton } from "@/components/ui/Button";
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
  { prefix: "/approvals", suggestions: ["Summarize what's waiting for my approval", "What does this risk level mean?"] },
  { prefix: "/opportunities", suggestions: ["Explain why this opportunity is ranked first", "Which opportunity is the fastest to ship?"] },
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
  content:
    "Hi — I'm the BusiGo Copilot. I can see your plan, workflows and recent runs, and I'll cite what I looked at. Ask me anything about your account, or what to build next.",
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

/**
 * BusiGo Copilot.
 *
 * A DOCKED side panel rather than a floating bubble overlaying the page: the spec asks for a
 * persistent Copilot that sits beside the work, and a panel that covers the table you are
 * asking about is self-defeating. On mobile it takes the full width, where a side-by-side
 * split has nowhere to go.
 *
 * The streaming reader, evidence-citation header and page-aware prompts are unchanged from
 * the previous implementation — this is a presentation and accessibility refactor, not a
 * rewrite of how the Copilot talks to the API.
 */
export function ChatWidget() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Cmd/Ctrl+J toggles the panel — deliberately not K, which belongs to the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
        copy[copy.length - 1] = { role: "assistant", content: "Sorry — I couldn't reach the Copilot just now." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      {/* Launcher — hidden while the panel is open, since the panel has its own close control. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open BusiGo Copilot (Ctrl+J)"
          className={cn(
            "fixed bottom-20 right-4 z-40 flex h-12 items-center gap-2 rounded-full border border-hairline bg-panel px-4 shadow-lg md:bottom-5 md:right-5",
            "transition-all duration-hover hover:shadow-xl active:scale-[0.98]",
            "focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          )}
        >
          <AssistantIcon size={22} />
          <span className="text-sm font-semibold text-ink">Copilot</span>
        </button>
      )}

      <aside
        // Not a modal dialog: the Copilot is meant to stay open beside the page you are
        // reading, so it must NOT trap focus or make the rest of the app inert. It is a
        // complementary landmark instead, reachable by landmark navigation.
        aria-label="BusiGo Copilot"
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-hairline bg-panel shadow-lg sm:w-96",
          "transition-transform duration-drawer ease-out",
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-3">
          <AssistantIcon size={22} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">BusiGo Copilot</p>
            <p className="truncate text-xs text-muted">Sees your plan, workflows and runs</p>
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
              className="rounded px-1.5 py-1 text-xs text-slate transition-colors duration-hover hover:bg-surface hover:text-ink"
            >
              Clear
            </button>
          )}
          <IconButton label="Close Copilot" size="sm" onClick={() => setOpen(false)}>
            <X size={17} />
          </IconButton>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
          // Streamed replies arrive token by token; `polite` announces the finished message
          // without interrupting, rather than re-reading on every chunk.
          aria-live="polite"
          aria-busy={streaming}
        >
          {messages.map((m, i) => (
            <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user" ? "bg-signal-strong text-white" : "bg-surface text-ink"
                )}
              >
                {m.content || (streaming && i === messages.length - 1 ? <TypingDots /> : "")}
              </div>
              {m.role === "assistant" && !!m.evidence?.length && !(streaming && i === messages.length - 1) && (
                <div className="mt-1.5 flex max-w-[88%] flex-wrap gap-1">
                  <span className="sr-only">Sources:</span>
                  {m.evidence.map((e) => (
                    <Link
                      key={`${e.type}-${e.id}`}
                      href={e.href}
                      className="inline-flex items-center gap-1 rounded border border-hairline bg-surface px-1.5 py-0.5 text-[11px] font-medium text-slate transition-colors duration-hover hover:border-signal hover:text-signal"
                    >
                      {e.label} <ExternalLink size={10} aria-hidden />
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
                  className="rounded-full border border-hairline px-2.5 py-1 text-xs text-slate transition-colors duration-hover hover:border-signal hover:text-signal"
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
          className="flex shrink-0 items-center gap-2 border-t border-hairline p-3"
        >
          <label htmlFor="copilot-input" className="sr-only">
            Ask the Copilot
          </label>
          <input
            id="copilot-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your workflows…"
            className="h-10 flex-1 rounded border border-hairline bg-panel px-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/40"
          />
          <Button type="submit" size="md" disabled={streaming || !input.trim()} className="w-10 px-0" aria-label="Send">
            {streaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </Button>
        </form>
      </aside>
    </>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-slate">
      <Sparkles size={13} className="animate-pulse" aria-hidden />
      <span className="animate-pulse">thinking…</span>
    </span>
  );
}
