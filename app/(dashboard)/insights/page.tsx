import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/business-os";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Progress } from "@/components/ui/Controls";
import { Metric, MetricStrip } from "@/components/patterns/Metric";
import { TrendChart, BarList, type TrendPoint } from "@/components/patterns/TrendChart";
import { AiCallout, EvidenceChip } from "@/components/patterns/Signals";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

interface Kpi {
  id: string;
  name: string;
  value: number | string | null;
  unit: string | null;
  created_at: string;
}

/**
 * Groups KPI rows by name and keeps those with enough history to plot.
 *
 * A "trend" from a single reading is not a trend — a one-point line implies a shape that
 * isn't in the data. Anything with fewer than three readings is shown as a current value
 * instead of being drawn as a chart.
 */
function kpiSeries(kpis: Kpi[]) {
  const byName = new Map<string, Kpi[]>();
  for (const k of kpis) {
    const list = byName.get(k.name) ?? [];
    list.push(k);
    byName.set(k.name, list);
  }
  const plottable: { name: string; unit: string; points: TrendPoint[]; latest: number; delta: number | null }[] = [];
  const singles: Kpi[] = [];

  for (const [name, rows] of byName) {
    const ordered = [...rows].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    const numeric = ordered.filter((r) => Number.isFinite(Number(r.value)));
    if (numeric.length < 3) {
      singles.push(ordered[ordered.length - 1]);
      continue;
    }
    const points = numeric.map((r) => ({
      label: new Date(r.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      value: Number(r.value),
    }));
    const first = points[0].value;
    const latest = points[points.length - 1].value;
    plottable.push({
      name,
      unit: numeric[numeric.length - 1].unit || "",
      points,
      latest,
      delta: first === 0 ? null : Math.round(((latest - first) / Math.abs(first)) * 100),
    });
  }
  return { plottable, singles };
}

export default async function InsightsPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const { business, opportunities, kpis, approvals, agents } = await getBusinessContext(workspace.id);

  // Run outcomes give the one genuinely time-series signal every workspace has, whether or
  // not anyone has defined a KPI yet.
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const { data: runs } = await supabase
    .from("workflow_runs")
    .select("status, started_at, workflow_id, workflows!inner(name, workspace_id)")
    .eq("workflows.workspace_id", workspace.id)
    .gte("started_at", since)
    .limit(2000);

  const runRows = (runs || []) as any[];
  const finished = runRows.filter((r) => r.status !== "running" && r.status !== "waiting");
  const succeeded = finished.filter((r) => r.status === "success" || r.status === "stopped_by_filter").length;

  // Weekly automation volume — a real trend from real rows.
  const weeks: TrendPoint[] = [];
  for (let w = 3; w >= 0; w--) {
    const start = Date.now() - (w + 1) * 7 * DAY_MS;
    const end = Date.now() - w * 7 * DAY_MS;
    const inWeek = runRows.filter((r) => {
      const t = +new Date(r.started_at);
      return t >= start && t < end;
    });
    weeks.push({
      label: new Date(end).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      value: inWeek.length,
      detail: `${inWeek.filter((r) => r.status === "failed").length} failed`,
    });
  }

  const byWorkflow = new Map<string, number>();
  for (const r of runRows) {
    const name = r.workflows?.name || "Unknown";
    byWorkflow.set(name, (byWorkflow.get(name) ?? 0) + 1);
  }
  const topWorkflows = Array.from(byWorkflow.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const { plottable, singles } = kpiSeries(kpis as Kpi[]);

  const score = Math.min(
    100,
    Math.round(
      (business ? 30 : 0) +
        Math.min(30, opportunities.length * 3) +
        Math.min(20, kpis.length * 2) +
        (agents.length ? 20 : 0)
    )
  );

  const hasAnything = runRows.length > 0 || kpis.length > 0 || opportunities.length > 0;

  return (
    <>
      <PageHeader
        title="Insights"
        description="What changed, why it matters, and what to do about it — from your real runs and KPIs."
        actions={
          <Button variant="secondary" href="/business-intelligence">
            Business Intelligence
          </Button>
        }
      />

      <MetricStrip className="mb-4 lg:grid-cols-4">
        <Metric
          label="Business OS score"
          value={score}
          suffix="/100"
          footer={<Progress value={score} label="Business OS completeness" />}
        />
        <Metric label="Runs" value={runRows.length} hint="last 30 days" />
        <Metric
          label="Success rate"
          value={finished.length ? Math.round((succeeded / finished.length) * 100) : "—"}
          suffix={finished.length ? "%" : undefined}
        />
        <Metric label="Open opportunities" value={opportunities.length} />
      </MetricStrip>

      <AiCallout
        className="mb-4"
        action={
          opportunities[0] ? (
            <Button size="sm" variant="secondary" href="/opportunities">
              Open
            </Button>
          ) : undefined
        }
      >
        <span className="font-semibold">What to look at next.</span>{" "}
        {opportunities[0]
          ? `"${opportunities[0].title}" is ranked highest at ${opportunities[0].priority_score}/100.`
          : business
            ? "Add your first automation opportunity so BusiGo can rank what's worth building."
            : "Complete Business Brain — everything here is ranked against what BusiGo knows about your business."}
        {approvals.length > 0 && ` ${approvals.length} action${approvals.length === 1 ? "" : "s"} also await approval.`}
      </AiCallout>

      {!hasAnything ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="Nothing to measure yet"
            body="Insights are built from your real workflow runs and KPI readings. Publish a workflow and trigger it, or record a KPI, and this page fills in."
            action={{ label: "Go to workflows", href: "/workflows" }}
            secondaryAction={{ label: "Open Business Brain", href: "/business-brain" }}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Automation volume</CardTitle>
                  <CardDescription>Runs per week over the last month.</CardDescription>
                </div>
                <Link href="/runs" className="shrink-0 text-sm text-signal hover:underline">
                  All runs
                </Link>
              </CardHeader>
              <TrendChart data={weeks} title="Workflow runs per week, last 4 weeks" />
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Busiest workflows</CardTitle>
              </CardHeader>
              {topWorkflows.length === 0 ? (
                <p className="text-sm text-slate">No runs in the last 30 days.</p>
              ) : (
                <BarList items={topWorkflows} />
              )}
            </Card>
          </div>

          {plottable.length > 0 && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {plottable.map((k) => (
                <Card key={k.name}>
                  <CardHeader>
                    <div>
                      <CardTitle>{k.name}</CardTitle>
                      <CardDescription>
                        Now {k.latest}
                        {k.unit ? ` ${k.unit}` : ""}
                        {k.delta !== null && ` · ${k.delta > 0 ? "+" : ""}${k.delta}% over the period`}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <TrendChart data={k.points} unit={k.unit} title={`${k.name} over time`} height={150} />
                </Card>
              ))}
            </div>
          )}

          {singles.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <div>
                  <CardTitle>Latest KPI readings</CardTitle>
                  <CardDescription>
                    Shown as values rather than charts — a trend needs at least three readings to be one.
                  </CardDescription>
                </div>
              </CardHeader>
              <ul className="divide-y divide-hairline">
                {singles.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-ink">{k.name}</p>
                      <p className="text-xs text-muted">{formatDate(k.created_at)}</p>
                    </div>
                    <strong className="tabular shrink-0 text-ink">
                      {k.value} {k.unit || ""}
                    </strong>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {opportunities.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <div>
                  <CardTitle>Where the value is</CardTitle>
                  <CardDescription>Top-ranked opportunities, by priority score.</CardDescription>
                </div>
                <Link href="/opportunities" className="shrink-0 text-sm text-signal hover:underline">
                  View all
                </Link>
              </CardHeader>
              <BarList
                items={opportunities.slice(0, 5).map((o: any) => ({ label: o.title, value: o.priority_score ?? 0 }))}
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                <EvidenceChip label="Business Brain" href="/business-brain" />
                <EvidenceChip label={`${opportunities.length} ranked`} href="/opportunities" />
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
