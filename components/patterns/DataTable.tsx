import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface Column<T> {
  /** Stable key, also used as the React key for cells. */
  key: string;
  header: ReactNode;
  /** Cell renderer. Kept as a render function so a cell can be a link, badge or button. */
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Hide below the given breakpoint — how this table degrades before it needs to scroll. */
  hideBelow?: "sm" | "md" | "lg";
  /** Numeric columns get tabular figures so digits line up down the column. */
  numeric?: boolean;
  width?: string;
}

const HIDE: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/**
 * Table with a scroll container of its own.
 *
 * The wrapper is `overflow-x-auto`, so a wide table scrolls *inside its own box* rather than
 * forcing the whole page sideways — spec §18 requires no horizontal page overflow at any
 * width, and an unwrapped table is the most common way that gets violated.
 *
 * Columns can drop out at a breakpoint via `hideBelow`, so narrow viewports lose the least
 * important columns before anything has to scroll at all. Anything genuinely essential on
 * mobile should stay visible and be rendered inside the primary cell instead.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
  caption,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Makes the whole row navigable. The first cell also renders a real link for keyboard use. */
  rowHref?: (row: T) => string;
  empty?: ReactNode;
  /** Screen-reader description of what the table contains. */
  caption: string;
  className?: string;
}) {
  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-hairline bg-panel", className)}>
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-hairline bg-surface">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted",
                  c.align === "right" && "text-right",
                  c.hideBelow && HIDE[c.hideBelow]
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={rowKey(row)}
                className={cn("transition-colors duration-hover", href && "hover:bg-surface/70")}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3 align-middle text-slate",
                      c.align === "right" && "text-right",
                      c.numeric && "tabular",
                      c.hideBelow && HIDE[c.hideBelow]
                    )}
                  >
                    {/* Only the first cell becomes the row's link — a whole-row <a> would
                        swallow the buttons and menus that live in later cells. */}
                    {i === 0 && href ? (
                      <Link href={href} className="block rounded font-medium text-ink hover:text-signal">
                        {c.cell(row)}
                      </Link>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
