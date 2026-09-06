import { cn } from "@/lib/utils";
import { Link2, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Signal Pulse — the product's signature motion, as a component.
 *
 * Renders ONLY when work is genuinely in flight. `active={false}` returns a static track, so
 * a caller can bind it straight to a run/agent status without branching, and an idle screen
 * never animates. Under prefers-reduced-motion the travelling highlight freezes (global rule
 * in globals.css) while the cyan track remains, so "this is running" survives without motion.
 */
export function SignalPulse({
  active,
  className,
  label,
}: {
  active: boolean;
  className?: string;
  /** Announced to assistive tech while active — motion alone conveys nothing to a screen reader. */
  label?: string;
}) {
  return (
    <div
      className={cn("h-1 w-full overflow-hidden rounded-full", active ? "signal-pulse" : "bg-surface", className)}
      role={active ? "status" : undefined}
      aria-label={active ? label || "Running" : undefined}
    />
  );
}

/**
 * Evidence chip — the visible half of BusiGo's "glass box" identity.
 *
 * Any AI-derived claim should be able to point at what it was derived from. This already
 * existed in embryo inside ChatWidget (the X-Copilot-Evidence header); promoting it to a
 * shared primitive is what lets Opportunities, Approvals and Insights cite their sources the
 * same way rather than each inventing a format.
 */
export function EvidenceChip({
  label,
  href,
  className,
}: {
  label: string;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      <Link2 size={11} className="shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </>
  );
  const base = cn(
    "inline-flex max-w-[14rem] items-center gap-1 rounded border border-hairline bg-surface px-1.5 py-0.5 text-[11px] font-medium text-slate",
    href && "transition-colors duration-hover hover:border-signal hover:text-signal",
    className
  );
  return href ? (
    <Link href={href} className={base}>
      {content}
    </Link>
  ) : (
    <span className={base}>{content}</span>
  );
}

/**
 * Confidence badge.
 *
 * Shows the number, not just a colour band — "how sure is this?" is exactly the question a
 * vague label ("High") fails to answer. Bucketing only drives the tone; the percentage is
 * always visible.
 */
export function ConfidenceBadge({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value <= 1 ? value * 100 : value);
  const tone =
    pct >= 75 ? "bg-success-soft text-success" : pct >= 50 ? "bg-warn-soft text-warn" : "bg-surface text-slate";
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold", tone, className)}
      title={`Model confidence: ${pct}%`}
    >
      {pct}% confident
    </span>
  );
}

/**
 * Impact / effort pair, rendered as a compact two-axis readout.
 *
 * These are the two facts that decide whether an opportunity is worth doing, so they belong
 * side by side rather than buried in a grid of four equal-weight stats.
 */
const LEVEL_WIDTH: Record<string, string> = { low: "w-1/3", medium: "w-2/3", high: "w-full", critical: "w-full" };

export function ImpactEffort({ impact, effort }: { impact: string; effort: string }) {
  return (
    <div className="flex items-center gap-4">
      {[
        { name: "Impact", level: impact, good: true },
        { name: "Effort", level: effort, good: false },
      ].map(({ name, level, good }) => (
        <div key={name} className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium text-muted">{name}</span>
            <span className="text-[11px] font-semibold capitalize text-slate">{level}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface">
            <div
              className={cn(
                "h-full rounded-full",
                LEVEL_WIDTH[level] ?? "w-1/2",
                // High impact is good; high effort is not. Colour follows meaning, and the
                // written level beside it carries the same information without colour.
                good ? "bg-signal" : level === "high" ? "bg-warn" : "bg-slate"
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Inline "AI says" callout — contextual AI, not a chatbot bolted on (spec §4). */
export function AiCallout({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-2.5 rounded-lg border border-signal/20 bg-signal-soft px-3.5 py-3",
        className
      )}
    >
      <Sparkles size={15} className="mt-0.5 shrink-0 text-signal" aria-hidden />
      <div className="min-w-0 flex-1 text-sm text-ink">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
