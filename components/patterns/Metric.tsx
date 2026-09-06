import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A single metric in the KPI strip.
 *
 * Deliberately NOT a large card. Spec §2 asks for "compact metric strips" and explicitly
 * warns against making every section a big rounded card — the previous Command Center used
 * four full Cards for four numbers, which gave a workflow count the same visual weight as
 * the entire recent-activity panel.
 *
 * Delta is rendered with an arrow AND a sign, never colour alone (WCAG 2.2 AA).
 */
export function Metric({
  label,
  value,
  suffix,
  delta,
  goodDirection = "up",
  deltaLabel,
  hint,
  footer,
  className,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  /** Percentage change. The arrow always follows the sign; only the colour depends on
   *  `goodDirection`. */
  delta?: number | null;
  /** Which direction is a good outcome for THIS metric. Failures, cost and churn improve by
   *  going down — colouring a fall in failures red would tell the reader the opposite of the
   *  truth, so the metric declares its own polarity rather than assuming "up is good". */
  goodDirection?: "up" | "down";
  deltaLabel?: string;
  hint?: string;
  footer?: ReactNode;
  className?: string;
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const dir = !hasDelta ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const DeltaIcon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  const isGood = dir === "flat" ? null : dir === goodDirection;

  return (
    <div className={cn("min-w-0 px-4 py-3.5", className)}>
      <p className="truncate text-xs font-medium text-slate">{label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="tabular text-2xl font-bold tracking-tight text-ink">{value}</span>
        {suffix && <span className="text-sm text-slate">{suffix}</span>}
      </div>
      {hasDelta && (
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            isGood === null ? "text-slate" : isGood ? "text-success-ink" : "text-danger-ink"
          )}
        >
          <DeltaIcon size={12} aria-hidden />
          <span>
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
          {deltaLabel && <span className="font-normal text-muted">{deltaLabel}</span>}
        </p>
      )}
      {hint && !hasDelta && <p className="mt-1 truncate text-xs text-muted">{hint}</p>}
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

/**
 * Horizontal strip of metrics sharing one bordered surface.
 *
 * One card with internal dividers rather than N floating cards: the metrics are one group of
 * related facts, so they read as a unit and cost a single border instead of four.
 */
export function MetricStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-hairline overflow-hidden rounded-xl border border-hairline bg-panel",
        "divide-x-0 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-5",
        // On the 2-col mobile layout the vertical rule between pairs still helps.
        "[&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-hairline sm:[&>*]:border-r-0",
        className
      )}
    >
      {children}
    </div>
  );
}
