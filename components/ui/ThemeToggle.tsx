"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "busigo-theme";

export function ThemeToggle({ className }: { className?: string }) {
  // Starts null so the server-rendered markup and the first client render match (the actual
  // theme was already applied pre-paint by the inline script in app/layout.tsx) — avoids a
  // hydration mismatch warning from guessing the icon before we can read the real state.
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage blocked — theme still applies for this session, just won't persist.
    }
    setIsDark(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={className || "rounded p-1.5 text-slate transition-colors hover:bg-surface"}
    >
      {isDark === null ? (
        <span className="block h-[18px] w-[18px]" />
      ) : isDark ? (
        <Sun size={18} className="animate-fade-in" />
      ) : (
        <Moon size={18} className="animate-fade-in" />
      )}
    </button>
  );
}
