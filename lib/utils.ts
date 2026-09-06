import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditional class names, with Tailwind conflict resolution.
 *
 * clsx alone concatenates, so `cn("p-5", "p-2")` emitted BOTH classes and the winner was
 * decided by their order in the generated stylesheet — not by the call site. That made a
 * component's `className` prop unreliable for overriding its own defaults (e.g. passing
 * `className="p-2"` to a Card whose base is `p-5` may or may not have taken effect).
 * twMerge resolves conflicting utilities in favour of the last one, so the override a
 * caller writes is the override they get. Non-conflicting classes are untouched.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "busigo";
