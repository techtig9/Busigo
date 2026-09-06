import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Metric, MetricStrip } from "@/components/patterns/Metric";
import { SignalPulse } from "@/components/patterns/Signals";
import { STEP_LABELS } from "@/lib/engine/types";
import { formatDate, formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function nodeClass(status: string) {
  if (status === "success") return "step-node--done";
  if (status === "failed") return "step-node--failed";
  if (status === "skipped") return "step-node--stopped";
  return "";
}

/** Pretty-prints a payload, and says so plainly when there isn't one. */
function Payload({ value, label }: { value: unknown; label: string }) {
  const json = JSON.stringify(value ?? null, null, 2);
  const empty = json === "null" || json === "{}";
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      {empty ? (
        <p className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-xs text-muted">None recorded</p>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-lg border border-hairline bg-surface p-2.5 font-mono text-[11px] leading-relaxed text-ink">
          {json}
        </pre>
      )}
    </div>
  );
}

export default async function RunDetailPage({ params }: { params: { workflowId: string; runId: string } }) {
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

  const { data: run } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("id", params.runId)
    .eq("workflow_id", params.workflowId)
    .single();
  if (!run) notFound();

  const { data: steps } = await supabase
    .from("workflow_run_steps")
    .select("*")
    .eq("run_id", params.runId)
    .order("created_at", { ascending: true });

  const rows = steps || [];
  const isRunning = run.status === "running";
  const totalMs = run.ended_at ? new Date(run.ended_at).getTime() - new Date(run.started_at).getTime() : null;
  const failedStep = rows.find((s: any) => s.status === "failed");

  return (
    <>
      <PageHeader
        title="Run detail"
        description={
          <>
            <Link href={`/runs/${workflow.id}`} className="text-signal hover:underline">
              {workflow.name}
            </Link>
            {" · "}
            <span className="font-mono text-xs">{run.id}</span>
          </>
        }
        actions={<StatusBadge status={run.status} />}
      />

      {isRunning && (
        <div className="mb-4">
          <SignalPulse active label="This run is executing" />
          <p className="mt-1.5 text-xs font-medium text-pulse">Executing now — this page shows the trace so far.</p>
        </div>
      )}

      <MetricStrip className="mb-4 lg:grid-cols-4">
        <Metric label="Steps traced" value={rows.length} />
        <Metric label="Duration" value={totalMs === null ? "—" : formatDuration(totalMs)} hint={isRunning ? "still running" : undefined} />
        <Metric label="Trigger" value={run.trigger_source} />
        <Metric label="Started" value={formatDate(run.started_at).split(",")[0]} hint={formatDate(run.started_at).split(", ")[1]} />
      </MetricStrip>

      {failedStep && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3">
          <p className="text-sm font-semibold text-danger">
            Failed at step &ldquo;{failedStep.step_key}&rdquo;
          </p>
          {failedStep.error && <p className="mt-1 text-sm text-danger/90">{failedStep.error}</p>}
        </div>
      )}

      <Card className="mb-4">
        <CardTitle className="mb-2">Trigger payload</CardTitle>
        <Payload value={run.trigger_payload} label="Received" />
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-ink">Step trace</h2>
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate">
            No step data recorded for this run{isRunning ? " yet" : ""}.
          </p>
        </Card>
      ) : (
        <ol className="list-none">
          {rows.map((step: any, i: number) => (
            <li key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center pt-4">
                <span className={cn("step-node", nodeClass(step.status))} aria-hidden />
                {i < rows.length - 1 && <span className="step-connector" aria-hidden />}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <Card density="compact">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-ink">
                      <span className="tabular text-muted">{i + 1}.</span>{" "}
                      {STEP_LABELS[step.type as keyof typeof STEP_LABELS] || step.type}{" "}
                      <span className="font-mono text-xs font-normal text-muted">({step.step_key})</span>
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular text-xs text-muted">{formatDuration(step.duration_ms)}</span>
                      <StatusBadge status={step.status} />
                    </div>
                  </div>

                  {step.error && (
                    <p className="mt-2 rounded border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
                      {step.error}
                    </p>
                  )}

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted outline-none hover:text-slate focus-visible:ring-2 focus-visible:ring-signal">
                      Input &amp; output
                    </summary>
                    <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                      <Payload value={step.input} label="Input" />
                      <Payload value={step.output} label="Output" />
                    </div>
                  </details>
                </Card>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
