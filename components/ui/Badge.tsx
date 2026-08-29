import { cn } from "@/lib/utils";

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
  | "bad";

const TONE_CLASSES: Record<Tone, string> = {
  signal: "bg-signal/10 text-signal",
  pulse: "bg-pulse/10 text-pulse",
  danger: "bg-danger/10 text-danger",
  warn: "bg-warn/10 text-warn",
  slate: "bg-surface text-slate",
  // Aliases used across dashboard pages — kept distinct from the base
  // tones above so call sites can express semantic intent directly.
  success: "bg-signal/10 text-signal",
  good: "bg-signal/10 text-signal",
  warning: "bg-warn/10 text-warn",
  neutral: "bg-surface text-slate",
  bad: "bg-danger/10 text-danger",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-semibold", TONE_CLASSES[tone])}>
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "success":
      return "signal";
    case "running":
      return "pulse";
    case "failed":
      return "danger";
    case "stopped_by_filter":
      return "warn";
    case "waiting":
      return "warn";
    default:
      return "slate";
  }
}
