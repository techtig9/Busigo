"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export interface TrendPoint {
  /** Short axis label, e.g. "12 Mar". */
  label: string;
  value: number;
  /** Extra context shown in the tooltip, e.g. "18 runs". */
  detail?: string;
}

/**
 * Single-series trend chart.
 *
 * Deliberately ONE series in ONE hue.
 *
 * The obvious first design — stacked success/failed bars — was rejected on evidence: running
 * the palette validator on the success green (#16A36B) against the danger red (#E55353)
 * returns a deuteranopia separation of ΔE 5.1, below the 6.0 floor. Adjacent green/red fills
 * are the textbook red-green-colourblind failure, and no amount of labelling makes an
 * adjacent pair below the floor legitimate. Plotting the success *rate* as one violet series
 * answers the same question ("is automation healthy?") with no adjacency to fail: a single
 * series needs no legend, and the title names it.
 *
 * The violet is bound through the CSS variable, so light (#6D4AFF) and dark (#8B6EFF) are
 * two separately chosen steps — both validated against their real surfaces (#FFFFFF and
 * #181E2D) — rather than one colour auto-flipped.
 *
 * A table view is always available, so the data is never locked inside an SVG.
 */
export function TrendChart({
  data,
  height = 180,
  unit = "",
  title,
  yMax,
}: {
  data: TrendPoint[];
  height?: number;
  unit?: string;
  /** Used as the caption of the accessible table view. */
  title: string;
  yMax?: number;
}) {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-lg border border-dashed border-hairline text-sm text-muted"
      >
        Not enough history yet
      </div>
    );
  }

  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          {/* No negative left margin: it pulls the Y axis off the canvas and clips the tick
                labels ("100%" renders as ")%"). YAxis.width reserves the gutter instead. */}
            <AreaChart data={data} accessibilityLayer={false} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--color-signal))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="rgb(var(--color-signal))" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Recessive grid: horizontal only, hairline colour, no vertical rules. */}
            <CartesianGrid
              vertical={false}
              stroke="rgb(var(--color-hairline))"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "rgb(var(--color-muted))", fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              width={40}
              tickLine={false}
              axisLine={false}
              domain={[0, yMax ?? "auto"]}
              tick={{ fill: "rgb(var(--color-muted))", fontSize: 11 }}
              tickFormatter={(v) => `${v}${unit}`}
            />
            <Tooltip
              cursor={{ stroke: "rgb(var(--color-hairline-strong))", strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as TrendPoint;
                return (
                  <div className="rounded-lg border border-hairline bg-panel px-2.5 py-2 shadow-md">
                    <p className="text-xs font-semibold text-ink">{label}</p>
                    <p className="tabular mt-0.5 text-sm font-bold text-signal">
                      {p.value}
                      {unit}
                    </p>
                    {p.detail && <p className="mt-0.5 text-[11px] text-slate">{p.detail}</p>}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="rgb(var(--color-signal))"
              strokeWidth={2}
              fill="url(#trendFill)"
              // >=8px hit target for the hover layer; dots only on hover to keep marks thin.
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "rgb(var(--color-panel))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Text alternative — the chart above is aria-hidden, so this is what assistive tech
          reads, and it is what a reader gets when the SVG can't be perceived. */}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted outline-none hover:text-slate focus-visible:ring-2 focus-visible:ring-signal">
          View as table
        </summary>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-hairline">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-semibold text-slate">
                  Date
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold text-slate">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.map((d) => (
                <tr key={d.label}>
                  <th scope="row" className="px-3 py-1.5 font-normal text-slate">
                    {d.label}
                  </th>
                  <td className="px-3 py-1.5 text-right font-medium text-ink">
                    {d.value}
                    {unit}
                    {d.detail && <span className="ml-1.5 font-normal text-muted">{d.detail}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

/**
 * Compact horizontal bars for a small ranked set — the honest alternative to a pie chart.
 * One hue, magnitude encoded by length, value direct-labelled.
 */
export function BarList({
  items,
  className,
}: {
  items: { label: string; value: number; href?: string }[];
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{i.label}</span>
            <span className="tabular shrink-0 font-medium text-slate">{i.value}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-signal transition-[width] duration-major ease-out"
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
