import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, MinusCircle, Clock } from "lucide-react";

type Tone =
  | "signal"
  | "pulse"
  | "danger"
  | "warn"
  | "slate"
  | "success"
  | "warning"
  | "good"
  | "neutral"
  | "bad"
  | "info";

const TONE_CLASSES: Record<Tone, string> = {
  signal: "bg-signal-soft text-signal-ink",
  pulse: "bg-pulse/10 text-pulse-ink",
  danger: "bg-danger-soft text-danger-ink",
  warn: "bg-warn-soft text-warn-ink",
  slate: "bg-surface text-slate",
  info: "bg-info-soft text-info-ink",
  // Semantic aliases used across dashboard pages. `success`/`good` previously resolved to
  // the same navy as `signal`, which made "succeeded" and "neutral" visually identical —
  // they now use the real success green.
  success: "bg-success-soft text-success-ink",
  good: "bg-success-soft text-success-ink",
  warning: "bg-warn-soft text-warn-ink",
  neutral: "bg-surface text-slate",
  bad: "bg-danger-soft text-danger-ink",
};

export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "success":
    case "completed":
    case "published":
    case "approved":
      return "success";
    case "running":
    case "in_progress":
      return "pulse";
    case "failed":
    case "rejected":
      return "danger";
    case "stopped_by_filter":
    case "waiting":
    case "pending":
      return "warn";
    default:
      return "slate";
  }
}

const STATUS_ICON: Partial<Record<Tone, typeof CheckCircle2>> = {
  success: CheckCircle2,
  good: CheckCircle2,
  danger: XCircle,
  bad: XCircle,
  warn: AlertTriangle,
  warning: AlertTriangle,
  pulse: Loader2,
  slate: MinusCircle,
  neutral: MinusCircle,
  info: Clock,
};

/**
 * A Badge that also carries a shape cue.
 *
 * WCAG 2.2 AA (spec §19) requires that colour is never the only means of conveying status —
 * a red pill and a green pill are indistinguishable to a viewer with deuteranopia, and
 * invisible to a screen reader. StatusBadge pairs every tone with a distinct icon, so the
 * status survives both. Use this for run/agent/approval state; plain Badge is for labels
 * that carry no status meaning (plan name, category, count).
 */
export function StatusBadge({
  status,
  tone,
  className,
  children,
}: {
  status: string;
  tone?: Tone;
  className?: string;
  children?: React.ReactNode;
}) {
  const resolved = tone ?? statusTone(status);
  const Icon = STATUS_ICON[resolved] ?? MinusCircle;
  const spinning = resolved === "pulse";
  return (
    <Badge tone={resolved} className={className}>
      <Icon size={12} className={cn("shrink-0", spinning && "animate-spin")} aria-hidden />
      {children ?? status.replace(/_/g, " ")}
    </Badge>
  );
}
