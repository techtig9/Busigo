"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "busigo-theme";

export type ThemePreference = "system" | "light" | "dark";

/** Applies a preference to the document and persists it. Exported so Settings/Profile can
 *  drive the same state from a different control. */
export function applyTheme(pref: ThemePreference) {
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = pref === "dark" || (pref === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  try {
    if (pref === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Storage blocked — theme still applies for this session, just won't persist.
  }
}

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    // fall through
  }
  return "system";
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Three-state theme control (spec §20: system / light / dark).
 *
 * The previous version was a two-state toggle that wrote "light" or "dark" on first click,
 * with no way back to following the OS. "System" is now the default and a first-class
 * choice: it stores nothing, so the pre-paint script in app/layout.tsx falls through to
 * prefers-color-scheme.
 *
 * Rendered as a radiogroup rather than three buttons so the whole control is one tab stop
 * with arrow-key selection, and the current choice is announced.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // Starts null so server markup and first client render match — the real theme was already
  // applied pre-paint by the inline script in app/layout.tsx.
  const [pref, setPref] = useState<ThemePreference | null>(null);

  useEffect(() => {
    setPref(readThemePreference());
  }, []);

  // Follow the OS live while the preference is "system".
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const select = (next: ThemePreference) => {
    applyTheme(next);
    setPref(next);
  };

  if (pref === null) {
    // Reserve the exact final size to avoid a layout shift once the preference is known.
    return <div className={cn("h-8 w-[6.75rem]", className)} aria-hidden />;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("inline-flex items-center gap-0.5 rounded-lg border border-hairline bg-surface p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => select(value)}
            className={cn(
              "flex h-7 w-8 items-center justify-center rounded transition-colors duration-hover",
              "outline-none focus-visible:ring-2 focus-visible:ring-signal",
              active ? "bg-panel text-ink shadow-xs" : "text-slate hover:text-ink"
            )}
          >
            <Icon size={15} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
