"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastContextValue {
  push: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idCounter = 0;

const TONE: Record<Tone, { icon: typeof CheckCircle2; classes: string; iconClass: string }> = {
  success: { icon: CheckCircle2, classes: "border-success/30", iconClass: "text-success" },
  error: { icon: XCircle, classes: "border-danger/30", iconClass: "text-danger" },
  warning: { icon: AlertTriangle, classes: "border-warn/30", iconClass: "text-warn" },
  info: { icon: Info, classes: "border-info/30", iconClass: "text-info" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Tone = "success") => {
    const id = ++idCounter;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((toast) => toast.id !== id)), 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {/*
        Live region (spec §19). Previously this container had no ARIA at all, so a toast was
        invisible to assistive tech — a screen reader user got no confirmation that their
        action had succeeded or failed. `polite` announces without interrupting; errors are
        marked `assertive` on the individual toast so a failure cuts through.
        aria-atomic keeps each message announced as a whole rather than word-by-word.
      */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((t) => {
          const { icon: Icon, classes, iconClass } = TONE[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              aria-live={t.tone === "error" ? "assertive" : "polite"}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-panel px-3.5 py-3 shadow-md",
                "animate-slide-up",
                classes
              )}
            >
              <Icon size={16} className={cn("mt-0.5 shrink-0", iconClass)} aria-hidden />
              <p className="flex-1 text-sm text-ink">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded p-0.5 text-slate transition-colors duration-hover hover:bg-surface hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback so a component doesn't crash if rendered outside the provider
    // (e.g. during isolated testing) — the toast just silently doesn't show.
    return { push: () => {} };
  }
  return ctx;
}
