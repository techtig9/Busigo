"use server";

import { requireWorkspace, writeAuditLog } from "@/lib/workspace/authorize";
import { executeWorkflowRun } from "@/lib/engine/executor";
import { normalizeToGraph, getNode } from "@/lib/engine/graph";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/** Dead-lettered run/step failures for this workspace — every retry was exhausted (lib/engine/retry.ts). */
export async function listDeadLettersAction() {
  const { supabase, workspace } = await requireWorkspace("viewer");
  const { data } = await supabase
    .from("dead_letter_jobs")
    .select("id, workflow_id, run_id, step_key, reason, replayed_at, created_at, workflows(name)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/**
 * Re-runs a dead-lettered workflow from the step that exhausted its retries, using the
 * run's original trigger payload — a fresh attempt count, not a continuation of the old one,
 * since whatever was blocking it (a downstream outage, a bad config since fixed) may no
 * longer apply.
 */
export async function replayDeadLetterAction(deadLetterId: string): Promise<ActionResult> {
  const { supabase, workspace, userId } = await requireWorkspace("manager");

  const { data: entry } = await supabase
    .from("dead_letter_jobs")
    .select("id, workflow_id, run_id, step_key, replayed_at")
    .eq("id", deadLetterId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!entry) return { error: "Dead-letter entry not found." };
  if (!entry.run_id || !entry.workflow_id) return { error: "This entry has no associated run to replay." };

  const { data: workflow } = await supabase.from("workflows").select("id, user_id, definition").eq("id", entry.workflow_id).single();
  if (!workflow) return { error: "The workflow this run belonged to no longer exists." };

  const { data: run } = await supabase.from("workflow_runs").select("id, trigger_payload").eq("id", entry.run_id).single();
  if (!run) return { error: "The original run no longer exists." };

  // The run's trigger_payload may still carry a stale __resume__ blob from the retry attempt
  // that led here (executor.ts's pauseForRetry sets it; nothing clears it once retries are
  // exhausted and the run is dead-lettered) — strip it so replay starts clean rather than
  // leaking internal retry bookkeeping into {{trigger.*}} merge fields.
  const cleanPayload = { ...(run.trigger_payload as Record<string, any> | null) };
  delete cleanPayload.__resume__;

  if (!entry.step_key) return { error: "This entry has no recorded step to resume from." }
  const graph = normalizeToGraph(workflow.definition);
  if (!getNode(graph, entry.step_key)) {
    return { error: "That step no longer exists in the current workflow definition — it may have been edited since." };
  }

  await supabase.from("workflow_runs").update({ status: "running", ended_at: null }).eq("id", entry.run_id);

  const result = await executeWorkflowRun({
    runId: entry.run_id,
    workflowId: workflow.id,
    workspaceId: workspace.id,
    userId: workflow.user_id,
    definition: workflow.definition,
    triggerPayload: cleanPayload,
    startAtKey: entry.step_key,
  });

  await supabase.from("dead_letter_jobs").update({ replayed_at: new Date().toISOString() }).eq("id", deadLetterId);
  await writeAuditLog({
    workspaceId: workspace.id,
    actorId: userId,
    action: "dead_letter.replayed",
    targetType: "workflow_run",
    targetId: entry.run_id,
    metadata: { stepKey: entry.step_key, finalStatus: result.finalStatus },
  });

  revalidatePath("/runs");
  return { success: true };
}
