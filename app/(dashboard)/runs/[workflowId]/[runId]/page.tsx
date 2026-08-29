import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatDate, formatDuration } from "@/lib/utils";
import { STEP_LABELS } from "@/lib/engine/types";
import { getWorkspaceContext } from "@/lib/workspace/context";

export const dynamic = "force-dynamic";

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs text-slate">{workflow.name}</p>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-ink">Run detail</h1>
          <Badge tone={statusTone(run.status)}>{run.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate">
          Started {formatDate(run.started_at)} · Trigger: {run.trigger_source}
          {run.ended_at && ` · Duration: ${formatDuration(new Date(run.ended_at).getTime() - new Date(run.started_at).getTime())}`}
        </p>
      </div>

      <Card>
        <h2 className="mb-2 font-bold text-ink">Trigger payload</h2>
        <pre className="overflow-x-auto rounded bg-surface p-3 font-mono text-xs text-ink">
          {JSON.stringify(run.trigger_payload, null, 2)}
        </pre>
      </Card>

      <div>
        <h2 className="mb-3 font-bold text-ink">Step trace</h2>
        {!steps || steps.length === 0 ? (
          <p className="text-sm text-slate">No step data recorded for this run.</p>
        ) : (
          <div>
            {steps.map((step, i) => (
              <div key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`step-node ${step.status === "success" ? "step-node--done" : step.status === "failed" ? "step-node--failed" : ""}`} />
                  {i < steps.length - 1 && <div className="step-connector" />}
                </div>
                <div className="flex-1 pb-4">
                  <Card>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">
                        {i + 1}. {STEP_LABELS[step.type as keyof typeof STEP_LABELS] || step.type}{" "}
                        <span className="font-normal text-slate">({step.step_key})</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge tone={statusTone(step.status)}>{step.status}</Badge>
                        <span className="text-xs text-slate">{formatDuration(step.duration_ms)}</span>
                      </div>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-signal">Input / output</summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs text-slate">Input</p>
                          <pre className="overflow-x-auto rounded bg-surface p-2 font-mono text-xs">{JSON.stringify(step.input, null, 2)}</pre>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-slate">Output</p>
                          <pre className="overflow-x-auto rounded bg-surface p-2 font-mono text-xs">{JSON.stringify(step.output, null, 2)}</pre>
                        </div>
                      </div>
                    </details>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
