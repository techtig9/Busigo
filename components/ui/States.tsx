import { cn } from "@/lib/utils";
import { Button } from "./Button";
import type { LucideIcon } from "lucide-react";
import { Inbox, AlertTriangle, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Skeleton block.
 *
 * Loading states must match the layout they replace so nothing reflows when real content
 * arrives (spec §17: "layout-matching skeletons, no layout jumps"). Compose these into a
 * shape that mirrors the real page rather than showing a centred spinner.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Announces that a region is loading, for assistive tech. Pair with visual Skeletons. */
export function LoadingRegion({ label = "Loading", children }: { label?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * Empty state.
 *
 * Spec §17 requires three things of every empty state: explain WHY it is empty, tell the
 * person what to do, and offer exactly one primary action. A bare "No items yet." — the
 * current pattern across most dashboard pages — fails all three.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
  secondaryAction,
  aiAction,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
  /** Optional "Create with AI" affordance (spec §17). */
  aiAction?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-slate" aria-hidden>
        <Icon size={20} />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate">{body}</p>
      {(action || secondaryAction || aiAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button href={action.href} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {aiAction && (
            <Button variant="subtle" href={aiAction.href} onClick={aiAction.onClick}>
              <Sparkles size={14} />
              {aiAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" href={secondaryAction.href} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Error state.
 *
 * Spec §17/§29: explain what happened, offer retry/recovery, and keep technical detail behind
 * a disclosure. The request id is surfaced (not hidden) because it is what makes a support
 * conversation possible — but it sits inside <details> so it never dominates the message.
 */
export function ErrorState({
  title = "Something went wrong",
  body,
  detail,
  requestId,
  onRetry,
  retryHref,
  supportHref = "/help",
  className,
}: {
  title?: string;
  body: string;
  detail?: string;
  requestId?: string;
  onRetry?: () => void;
  retryHref?: string;
  supportHref?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)} role="alert">
      <span
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-danger-soft text-danger"
        aria-hidden
      >
        <AlertTriangle size={20} />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-slate">{body}</p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {(onRetry || retryHref) && (
          <Button onClick={onRetry} href={retryHref}>
            Try again
          </Button>
        )}
        <Button variant="ghost" href={supportHref}>
          Get help
        </Button>
      </div>

      {(detail || requestId) && (
        <details className="mt-5 w-full max-w-md text-left">
          <summary className="cursor-pointer text-xs font-medium text-slate outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-signal">
            View details
          </summary>
          <div className="mt-2 rounded-lg border border-hairline bg-surface p-3">
            {requestId && (
              <p className="font-mono text-[11px] text-slate">
                Request ID: <span className="text-ink">{requestId}</span>
              </p>
            )}
            {detail && (
              <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-slate">
                {detail}
              </pre>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
