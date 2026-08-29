import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { executeWorkflowRun } from "@/lib/engine/executor";
import { nextRunAfter } from "@/lib/engine/cron";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleSupabase();
  const now = new Date();
  const results = { resumed: 0, retried: 0, scheduled_fired: 0, errors: [] as string[] };

  // 1. Resume any Delay-paused OR retry-paused run whose resume_at has passed.
  // (Same trigger_payload.__resume__ mechanism for both — see executor.ts pauseRun/
  // pauseForRetry. A retryAttempt in the resume state means "re-run this same step",
  // not "continue from the next one" — executeWorkflowRun handles that distinction
  // internally via startAtIndex + retryAttempt, this route just passes both through.)
  const { data: waitingRuns } = await supabase
    .from("workflow_runs")
    .select("id, workflow_id, trigger_payload")
    .eq("status", "waiting")
    .lte("resume_at", now.toISOString());

  for (const run of waitingRuns || []) {
    try {
      const { data: workflow } = await supabase
        .from("workflows")
        .select("id, user_id, workspace_id, definition")
        .eq("id", run.workflow_id)
        .single();
      if (!workflow) continue;

      const resumeState = (run.trigger_payload as any)?.__resume__;
      const basePayload = { ...(run.trigger_payload as any) };
      delete basePayload.__resume__;
      const isRetry = typeof resumeState?.retryAttempt === "number";

      await executeWorkflowRun({
        runId: run.id,
        workflowId: workflow.id,
        workspaceId: workflow.workspace_id,
        userId: workflow.user_id,
        definition: workflow.definition,
        triggerPayload: basePayload,
        // resumeState.key may itself be null (a Delay step with no successor — "nothing left,
        // finish on resume") — pass it through as-is rather than defaulting to undefined,
        // which would incorrectly restart the run from its entry node instead.
        startAtKey: resumeState ? (resumeState.key ?? null) : undefined,
        // pauseRun/pauseForRetry (executor.ts) store ctx.data directly under __resume__.context
        // — it is already the flat { trigger, step1, step2, ... } object, not wrapped in
        // another "data" layer. Reading `.context.data` here would silently drop every prior
        // step's output on resume.
        priorContext: resumeState?.context ?? {},
        retryAttempt: resumeState?.retryAttempt,
      });
      if (isRetry) results.retried += 1;
      else results.resumed += 1;
    } catch (e: any) {
      results.errors.push(`resume ${run.id}: ${e.message}`);
    }
  }

  // 2. Fire any schedule-triggered workflow whose next_run_at has passed.
  const { data: dueWorkflows } = await supabase
    .from("workflows")
    .select("id, user_id, workspace_id, definition, trigger_config, next_run_at")
    .eq("trigger_type", "schedule")
    .eq("status", "published")
    .lte("next_run_at", now.toISOString());

  for (const workflow of dueWorkflows || []) {
    try {
      const { data: run } = await supabase
        .from("workflow_runs")
        .insert({ workflow_id: workflow.id, workspace_id: workflow.workspace_id, trigger_source: "schedule", status: "running", trigger_payload: {} })
        .select("id")
        .single();

      if (run) {
        await executeWorkflowRun({
          runId: run.id,
          workflowId: workflow.id,
          workspaceId: workflow.workspace_id,
          userId: workflow.user_id,
          definition: workflow.definition,
          triggerPayload: {},
        });
        results.scheduled_fired += 1;
      }

      const cron = (workflow.trigger_config as any)?.cron;
      const next = cron ? nextRunAfter(cron, now) : null;
      await supabase.from("workflows").update({ next_run_at: next?.toISOString() ?? null }).eq("id", workflow.id);
    } catch (e: any) {
      results.errors.push(`schedule ${workflow.id}: ${e.message}`);
    }
  }

  return NextResponse.json(results);
}
