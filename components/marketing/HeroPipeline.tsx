import { Webhook, Filter, Sparkles, Mail, CheckCircle2 } from "lucide-react";

/**
 * The hero's product preview: a workflow pipeline running.
 *
 * A screenshot would be stale the day the UI changes and unreadable at 375px. This shows the
 * one thing a visitor needs to understand in the first five seconds — a trigger arrives,
 * steps execute in order, and a human approves the step that matters — as the product's own
 * vocabulary rather than a picture of it.
 *
 * A Server Component: there is no state and no interactivity, so it costs no JavaScript. The
 * whole animation is CSS keyframes on staggered delays (see globals.css), which the browser
 * can run without the main thread, and which collapse to a static lit diagram under
 * prefers-reduced-motion.
 *
 * The graphic is aria-hidden and carries a real text description for screen readers, because
 * an animated decoration that announces five disconnected words is worse than one that
 * announces a sentence.
 */

const STEPS = [
  { icon: Webhook, label: "Trigger", detail: "Form submitted" },
  { icon: Filter, label: "Filter", detail: "Deal size > £5k" },
  { icon: Sparkles, label: "AI Action", detail: "Draft the reply" },
  { icon: Mail, label: "Send Email", detail: "Await approval" },
  { icon: CheckCircle2, label: "Done", detail: "Logged to CRM" },
];

// One 6s cycle across five nodes: each node lights ~0.9s after the one before it.
const STAGGER_MS = 900;

export function HeroPipeline() {
  return (
    <div className="mx-auto mt-14 w-full max-w-4xl">
      <p className="sr-only">
        An illustration of a BusiGo workflow running: a form submission triggers it, a filter
        keeps deals over five thousand pounds, an AI action drafts the reply, the email waits
        for human approval, and the result is logged to the CRM.
      </p>

      <div
        aria-hidden="true"
        className="relative rounded-2xl border border-hairline bg-panel/70 p-5 shadow-sm backdrop-blur sm:p-7"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-0">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const delay = `${i * STAGGER_MS}ms`;
            return (
              <div key={step.label} className="flex flex-1 items-center gap-4 sm:flex-col sm:gap-0">
                <div
                  className="pipeline-node flex w-full min-w-0 flex-1 flex-col items-center gap-1.5 sm:flex-none"
                  style={{ animationDelay: delay }}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-surface text-signal">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span className="text-center text-xs font-semibold text-ink">{step.label}</span>
                  <span className="text-center text-[11px] leading-tight text-muted">{step.detail}</span>
                </div>

                {/* Connector to the next step. Vertical on mobile, horizontal from sm up — the
                    pipeline reads top-to-bottom on a phone, where five nodes in a row would be
                    unreadably narrow. */}
                {i < STEPS.length - 1 && (
                  <span className="relative hidden h-px w-full shrink-0 self-start bg-hairline sm:mt-[22px] sm:block">
                    <span
                      className="pipeline-flow absolute inset-0 block bg-accent"
                      style={{ animationDelay: delay }}
                    />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
