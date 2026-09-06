import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatDate, formatDuration } from "@/lib/utils";
import { ExportButtons } from "./ExportButtons";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function WorkflowRunsPage({ params }: { params: { workflowId: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();

  const { data: workflow } = await supabase
    .from("workflows")
    .select("id, name")
    .eq("id", params.workflowId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!workflow) notFound();

  const { data: runs } = await supabase
    .from("workflow_runs")
    .select("id, status, trigger_source, started_at, ended_at")
    .eq("workflow_id", params.workflowId)
    .order("started_at", { ascending: false })
    .limit(200);

  const { data: allSteps } = await supabase
    .from("workflow_run_steps")
    .select("run_id, step_key, type, status, duration_ms")
    .in("run_id", (runs || []).map((r) => r.id));

  const total = runs?.length || 0;
  const successCount = runs?.filter((r) => r.status === "success").length || 0;
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

  const durations = (runs || [])
    .filter((r) => r.ended_at)
    .map((r) => new Date(r.ended_at!).getTime() - new Date(r.started_at).getTime());
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const failuresByStep: Record<string, number> = {};
  (allSteps || []).forEach((s) => {
    if (s.status === "failed") failuresByStep[s.step_key] = (failuresByStep[s.step_key] || 0) + 1;
  });
  const mostCommonFailingStep = Object.entries(failuresByStep).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const exportData = (runs || []).map((run) => ({
    run_id: run.id,
    status: run.status,
    trigger_source: run.trigger_source,
    started_at: run.started_at,
    ended_at: run.ended_at,
    steps: JSON.stringify((allSteps || []).filter((s) => s.run_id === run.id)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="{workflow.name} — Runs" />
        <ExportButtons workflowName={workflow.name} data={exportData} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><p className="text-xs uppercase tracking-wide text-slate">Total runs</p><p className="mt-1 text-xl font-bold text-ink">{total}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-slate">Success rate</p><p className="mt-1 text-xl font-bold text-ink">{successRate}%</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-slate">Most-failing step</p><p className="mt-1 text-xl font-bold text-ink">{mostCommonFailingStep}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-slate">Avg duration</p><p className="mt-1 text-xl font-bold text-ink">{avgDuration != null ? formatDuration(avgDuration) : "—"}</p></Card>
      </div>

      <Card>
        {!runs || runs.length === 0 ? (
          <p className="text-sm text-slate">No runs yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="py-2">Started</th>
                <th className="py-2">Trigger</th>
                <th className="py-2">Status</th>
                <th className="py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="py-2">
                    <Link href={`/runs/${workflow.id}/${run.id}`} className="text-signal hover:underline">
                      {formatDate(run.started_at)}
                    </Link>
                  </td>
                  <td className="py-2 capitalize text-slate">{run.trigger_source}</td>
                  <td className="py-2"><Badge tone={statusTone(run.status)}>{run.status}</Badge></td>
                  <td className="py-2 text-slate">
                    {run.ended_at ? formatDuration(new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
