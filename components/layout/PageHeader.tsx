import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { segmentLabel } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Canonical page container width.
 *
 * Dashboard pages previously used six different `max-w-*` values (6xl ×10, 5xl ×7, 3xl ×4,
 * lg ×2, 7xl ×1, 2xl ×1), so the content column visibly jumped width on every navigation.
 * One constant, applied by AppShell, removes that entirely. Screens that genuinely need the
 * full viewport — the workflow canvas — opt out explicitly rather than inventing a width.
 */
export const PAGE_CONTAINER = "mx-auto w-full max-w-6xl";

/**
 * Breadcrumbs derived from the URL.
 *
 * Rendered as an ordered list inside <nav aria-label="Breadcrumb">, with aria-current on the
 * last crumb — the pattern assistive tech expects. The final segment is plain text, not a
 * link to the page you are already on.
 */
export function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    return { href, label: segmentLabel(segment, href), last: i === segments.length - 1 };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-slate">
        {crumbs.map((c) => (
          <li key={c.href} className="flex items-center gap-1">
            {c.last ? (
              <span aria-current="page" className="font-medium text-ink">
                {c.label}
              </span>
            ) : (
              <>
                <Link href={c.href} className="rounded transition-colors duration-hover hover:text-ink">
                  {c.label}
                </Link>
                <ChevronRight size={12} className="text-muted" aria-hidden />
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Standard page heading block: title, optional description, and a primary action area.
 *
 * Every dashboard page hand-rolled this with slightly different spacing and heading sizes.
 * One component makes the hierarchy consistent and guarantees exactly one <h1> per page.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-slate">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
