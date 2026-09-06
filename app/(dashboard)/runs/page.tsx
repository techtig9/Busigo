import Link from "next/link";
import { Activity } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { roleAtLeast } from "@/lib/workspace/roles";
import { listDeadLettersAction } from "@/lib/actions/reliability";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { Metric, MetricStrip } from "@/components/patterns/Metric";
import { DataTable, type Column } from "@/components/patterns/DataTable";
import { SignalPulse } from "@/components/patterns/Signals";
import { DeadLetterList } from "./DeadLetterList";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface RunRow {
  id: string;
  status: string;
  started_at: string;
  workflow_id: string;
  workflows?: { name?: string } | null;
}

export default async function RunsOverviewPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace, role } = await getWorkspaceContext();

  const [{ data: workflows }, { data: recentRuns }, deadLetters] = await Promise.all([
    supabase
      .from("workflows")
      .select("id, name, status")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("workflow_runs")
      .select("id, status, started_at, workflow_id, workflows!inner(name, workspace_id)")
      .eq("workflows.workspace_id", workspace.id)
      .order("started_at", { ascending: false })
      .limit(50),
    listDeadLettersAction(),
  ]);

  const runs = (recentRuns || []) as RunRow[];
  const running = runs.filter((r) => r.status === "running").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const succeeded = runs.filter((r) => r.status === "success" || r.status === "stopped_by_filter").length;

  const columns: Column<RunRow>[] = [
    {
      key: "workflow",
      header: "Workflow",
      cell: (r) => <span className="block truncate">{r.workflows?.name || "Unknown workflow"}</span>,
    },
    { key: "started", header: "Started", hideBelow: "sm", cell: (r) => formatDate(r.started_at) },
    {
      key: "status",
      header: "Status",
      align: "right",
      cell: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Runs"
        description="Every execution, traced step by step — real inputs, outputs, durations and errors."
      />

      {running > 0 && (
        <div className="mb-4">
          <SignalPulse active label={`${running} ${running === 1 ? "run" : "runs"} executing`} />
          <p className="mt-1.5 text-xs font-medium text-pulse-ink">
            {running} {running === 1 ? "run" : "runs"} executing now
          </p>
        </div>
      )}

      {runs.length > 0 && (
        <MetricStrip className="mb-4 lg:grid-cols-4">
          <Metric label="Recent runs" value={runs.length} hint="last 50" />
          <Metric label="Succeeded" value={succeeded} />
          <Metric label="Failed" value={failed} goodDirection="down" />
          <Metric label="Dead-lettered" value={deadLetters.length} goodDirection="down" hint="needs replay" />
        </MetricStrip>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-ink">Recent activity, all workflows</h2>
          <DataTable
            caption="Most recent workflow runs across this workspace"
            columns={columns}
            rows={runs}
            rowKey={(r) => r.id}
            rowHref={(r) => `/runs/${r.workflow_id}/${r.id}`}
            empty={
              <div className="rounded-xl border border-hairline bg-panel">
                <EmptyState
                  icon={Activity}
                  title="No runs yet"
                  body="Publish a workflow and trigger it — a webhook call, a scheduled tick, or a form submission — and its full trace appears here."
                  action={{ label: "Go to workflows", href: "/workflows" }}
                />
              </div>
            }
          />
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>By workflow</CardTitle>
          </CardHeader>
          {!workflows || workflows.length === 0 ? (
            <p className="text-sm text-slate">No workflows yet.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {workflows.map((wf) => (
                <li key={wf.id}>
                  <Link
                    href={`/runs/${wf.id}`}
                    className="-mx-2 flex items-center justify-between gap-2 rounded px-2 py-2.5 text-sm transition-colors duration-hover hover:bg-surface"
                  >
                    <span className="truncate text-ink">{wf.name}</span>
                    <Badge tone={wf.status === "published" ? "success" : "slate"}>{wf.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Dead-lettered steps</CardTitle>
            <CardDescription>
              A step that failed repeatedly — network errors, 5xx, or 429 responses — retries automatically with backoff
              up to 3 times before landing here. Manager role or above can replay one once the underlying issue is fixed.
            </CardDescription>
          </div>
        </CardHeader>
        <DeadLetterList entries={deadLetters as any} canReplay={roleAtLeast(role, "manager")} />
      </Card>
    </>
  );
}
