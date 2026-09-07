"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  id: string;
  label: string;
  done: boolean;
  index: number;
}

/**
 * Horizontal step indicator.
 *
 * Every step is reachable, not just the next one — someone who wants to connect an app before
 * filling in their goals should not be blocked, and the completion score is derived from real
 * state anyway, so skipping ahead cannot fake progress.
 *
 * Rendered as a list with `aria-current` on the active step and a text-visible "done"/"to do"
 * state, so completion is not conveyed by the tick colour alone. It scrolls horizontally
 * inside its own container rather than wrapping, which would shift everything below it.
 */
export function OnboardingStepper({
  steps,
  active,
  onSelectAction,
}: {
  steps: StepperStep[];
  active: number;
  onSelectAction: (step: number) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (index: number) => {
    startTransition(async () => {
      // Persist the cursor so returning later resumes here, then navigate.
      await onSelectAction(index);
      router.push(`/onboarding?step=${index}`);
    });
  };

  return (
    <nav aria-label="Onboarding steps">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {steps.map((s, i) => {
          const isActive = i === active;
          return (
            <li key={s.id} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => go(i)}
                disabled={pending}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors duration-hover",
                  "outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1 focus-visible:ring-offset-canvas",
                  isActive
                    ? "border-signal bg-signal-soft text-signal-ink"
                    : "border-hairline bg-panel text-slate hover:border-hairline-strong hover:text-ink"
                )}
              >
                <span
                  className={cn(
                    "tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    s.done ? "bg-success text-white" : isActive ? "bg-signal-strong text-white" : "bg-surface text-slate"
                  )}
                  aria-hidden
                >
                  {s.done ? <Check size={11} strokeWidth={3} /> : i + 1}
                </span>
                <span className="whitespace-nowrap font-medium">{s.label}</span>
                <span className="sr-only">{s.done ? " — done" : " — not done yet"}</span>
              </button>
              {i < steps.length - 1 && <span className="mx-0.5 h-px w-3 shrink-0 bg-hairline" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
