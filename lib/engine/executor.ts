import { createServiceRoleSupabase } from "@/lib/supabase/server";
import type { StepDefinition, StepStatus } from "@/types/database";
import type { RunContext, StepHandler } from "./types";
import { MAX_STEPS_PER_RUN } from "./guard-self-trigger";
import { httpRequestStep } from "./steps/http-request";
import { sendEmailStep } from "./steps/send-email";
import { delayStep } from "./steps/delay";
import { filterStep } from "./steps/filter";
import { transformDataStep } from "./steps/transform-data";
import { aiActionStep } from "./steps/ai-action";
import { webhookResponseStep } from "./steps/webhook-response";
import { deductRunCredits } from "@/lib/plans";
import { sendAlertEmail } from "./steps/send-email";
import { isRetryableStepFailure, computeStepBackoffSeconds, MAX_STEP_RETRY_ATTEMPTS } from "./retry";
import { writeDeadLetter } from "@/lib/platform/reliability";
import { normalizeToGraph, findEntryNode, nextNodeKey, resolveFilterNext, getNode, type WorkflowDefinition, type WorkflowGraph, type GraphNode } from "./graph";

const HANDLERS: Record<string, StepHandler> = {
  http_request: httpRequestStep,
  send_email: sendEmailStep,
  delay: delayStep,
  filter: filterStep,
  transform_data: transformDataStep,
  ai_action: aiActionStep,
  webhook_response: webhookResponseStep,
};

export interface ExecuteRunOptions {
  runId: string;
  workflowId: string;
  workspaceId: string;
  userId: string;
  /** Either format — legacy linear array (every workflow published before Phase 4) or a graph. Normalized internally via lib/engine/graph.ts. */
  definition: WorkflowDefinition;
  triggerPayload: Record<string, any>;
  /** Node key to resume from — used when a Delay step paused the run, or a step is being retried, and the cron tick resumes it. `undefined` means a fresh run (start at the entry node); explicit `null` means "resume with nothing left to do" (a Delay step with no successor — finish immediately). */
  startAtKey?: string | null;
  /** Prior step outputs, needed to resume a run's context after a Delay pause or retry. */
  priorContext?: Record<string, any>;
  /** How many times the step at startAtKey has already been retried — 0 for a fresh run or a Delay-step resume. */
  retryAttempt?: number;
  /** Called after every single step, in order — the SSE test-run endpoint uses this to stream progress live. */
  onStepUpdate?: (update: {
    stepKey: string;
    type: string;
    status: string;
    output: any;
    error?: string;
    waitingUntil?: string;
  }) => void;
}

export interface ExecuteRunResult {
  finalStatus: "success" | "failed" | "stopped_by_filter" | "waiting";
  webhookResponse?: { statusCode: number; body: any };
}

function toStepDefinition(node: GraphNode): StepDefinition {
  return { key: node.key, type: node.type, config: node.config };
}

/**
 * Executes a workflow by walking its graph from the entry node (or a resume point) along
 * edges — not a flat index. A `filter` step's pass/fail result selects which outgoing edge
 * to follow (see lib/engine/graph.ts resolveFilterNext); every other step type follows its
 * single edge, if any. Every visited step's real input/output/status/duration is persisted
 * to workflow_run_steps — no exceptions (Hard Constraint 5). A step is only ever marked
 * success because its real side effect actually succeeded.
 *
 * Transient http_request failures (network error, 5xx, 429 — see lib/engine/retry.ts) pause
 * the run and retry the SAME node with backoff via the existing Delay-style resume mechanism,
 * up to MAX_STEP_RETRY_ATTEMPTS, before falling through to the normal fail + dead-letter path.
 * Every other failure fails immediately, same as before — retrying a permanent problem (bad
 * auth, malformed config, a blocked SSRF target) would just delay the failure notification.
 */
export async function executeWorkflowRun(opts: ExecuteRunOptions): Promise<ExecuteRunResult> {
  const supabase = createServiceRoleSupabase();
  const graph = normalizeToGraph(opts.definition);
  const ctx: RunContext = { data: { trigger: opts.triggerPayload, ...(opts.priorContext || {}) } };
  let aiActionStepsRun = 0;

  if (graph.nodes.length > MAX_STEPS_PER_RUN) {
    await finishRun(supabase, opts.runId, "failed");
    return { finalStatus: "failed" };
  }

  let currentKey: string | null =
    opts.startAtKey !== undefined ? opts.startAtKey : (findEntryNode(graph)?.key ?? null);
  let visitedCount = 0;

  while (currentKey) {
    // A cycle would otherwise loop forever — validateGraph rejects one at save time, but a
    // run in flight when an edit removes a guard, or a hand-crafted definition via the API,
    // shouldn't be able to hang a worker indefinitely either.
    if (++visitedCount > MAX_STEPS_PER_RUN) {
      await finishRun(supabase, opts.runId, "failed");
      return { finalStatus: "failed" };
    }

    const node = getNode(graph, currentKey);
    if (!node) {
      await finishRun(supabase, opts.runId, "failed");
      return { finalStatus: "failed" };
    }
    const step = toStepDefinition(node);
    const handler = HANDLERS[step.type];
    const isRetryOfThisStep = currentKey === opts.startAtKey && (opts.retryAttempt ?? 0) > 0;

    if (!handler) {
      await persistStep(supabase, opts.runId, step, "failed", null, `Unknown step type: "${step.type}"`, 0);
      opts.onStepUpdate?.({ stepKey: step.key, type: step.type, status: "failed", output: null, error: `Unknown step type: "${step.type}"` });
      await finishRun(supabase, opts.runId, "failed");
      return { finalStatus: "failed" };
    }

    const started = Date.now();
    const result = await handler({ step, ctx, runId: opts.runId, workflowId: opts.workflowId, workspaceId: opts.workspaceId, userId: opts.userId });
    const durationMs = Date.now() - started;

    if (result.status === "failed" && isRetryableStepFailure({ stepType: step.type, output: result.output, error: result.error })) {
      const attempt = isRetryOfThisStep ? (opts.retryAttempt ?? 0) : 0;
      if (attempt < MAX_STEP_RETRY_ATTEMPTS) {
        const nextAttempt = attempt + 1;
        const backoffSeconds = computeStepBackoffSeconds(nextAttempt);
        // Not persisted as a terminal "failed" step row — this attempt is being retried, not
        // given up on. The retry's own eventual success/failure gets its own persisted row.
        opts.onStepUpdate?.({
          stepKey: step.key,
          type: step.type,
          status: "retrying",
          output: result.output,
          error: `${result.error} — retrying (attempt ${nextAttempt}/${MAX_STEP_RETRY_ATTEMPTS}) in ${backoffSeconds}s`,
        });
        await pauseForRetry(supabase, opts.runId, currentKey, nextAttempt, backoffSeconds, ctx.data);
        return { finalStatus: "waiting" };
      }
      // Retries exhausted — fall through to the normal permanent-failure path below,
      // but record it to the dead-letter queue first so it's visible and replayable.
      await writeDeadLetter({
        workspaceId: opts.workspaceId,
        workflowId: opts.workflowId,
        runId: opts.runId,
        stepKey: step.key,
        reason: `Exhausted ${MAX_STEP_RETRY_ATTEMPTS} retries: ${result.error}`,
        payload: { step, output: result.output, triggerPayload: opts.triggerPayload },
      });
    }

    // Map the engine-level outcome to the DB's allowed per-step status (success/failed/skipped).
    // "stopped_by_filter" is a real, successful evaluation of the Filter step — recorded as
    // "success" at the step level, with the outcome visible in output.passed; the run itself
    // only carries stopped_by_filter forward as its OWN status when the false branch has
    // nowhere to go (see below) — otherwise the run just continues down that branch.
    const dbStatus: StepStatus = result.status === "stopped_by_filter" ? "success" : result.status;
    await persistStep(supabase, opts.runId, step, dbStatus, result.output, result.error, durationMs);
    opts.onStepUpdate?.({
      stepKey: step.key,
      type: step.type,
      status: result.status,
      output: result.output,
      error: result.error,
      waitingUntil: result.waitingUntil,
    });

    // Successful steps' output becomes available to every later step under its own key.
    ctx.data[step.key] = result.output;

    if (step.type === "ai_action" && result.status === "success") {
      aiActionStepsRun += 1;
    }

    if (result.waitingUntil) {
      // Resume at the node AFTER this Delay step, not the Delay step itself — resolved now,
      // while the graph is in scope, and stored verbatim (including null, if the Delay step
      // is the last node) so resuming never re-runs the Delay a second time.
      const afterDelayKey = nextNodeKey(graph, currentKey);
      await pauseRun(supabase, opts.runId, result.waitingUntil, afterDelayKey, ctx.data);
      return { finalStatus: "waiting" };
    }

    if (result.status === "failed") {
      await markUnreachableSkipped(supabase, opts.runId, graph, currentKey);
      await finishRun(supabase, opts.runId, "failed");
      await alertOwnerOfFailure(supabase, opts.workflowId, opts.runId, step.key, result.error);
      return { finalStatus: "failed" };
    }

    if (step.type === "webhook_response") {
      await finishRun(supabase, opts.runId, "success");
      await deductRunCredits(opts.workspaceId, opts.userId, "success", aiActionStepsRun);
      return { finalStatus: "success", webhookResponse: result.output };
    }

    // Advance along the graph: a filter branches on its pass/fail result (with a legacy
    // fallback for pre-Phase-4 workflows — see resolveFilterNext), everything else follows
    // its single outgoing edge, if any.
    const next: string | null =
      step.type === "filter" ? resolveFilterNext(graph, currentKey, result.status === "success") : nextNodeKey(graph, currentKey);

    if (next === null && result.status === "stopped_by_filter") {
      // No "false" edge to follow — the run ends here, exactly like the pre-Phase-4 behavior
      // when a Filter step's condition wasn't met.
      await markUnreachableSkipped(supabase, opts.runId, graph, currentKey);
      await finishRun(supabase, opts.runId, "stopped_by_filter");
      await deductRunCredits(opts.workspaceId, opts.userId, "stopped_by_filter", aiActionStepsRun);
      return { finalStatus: "stopped_by_filter" };
    }

    currentKey = next;
  }

  await finishRun(supabase, opts.runId, "success");
  await deductRunCredits(opts.workspaceId, opts.userId, "success", aiActionStepsRun);
  return { finalStatus: "success" };
}

async function persistStep(
  supabase: ReturnType<typeof createServiceRoleSupabase>,
  runId: string,
  step: StepDefinition,
  status: StepStatus,
  output: any,
  error: string | undefined,
  durationMs: number
) {
  await supabase.from("workflow_run_steps").insert({
    run_id: runId,
    step_key: step.key,
    type: step.type,
    input: step.config,
    output: error ? { error } : output,
    status,
    duration_ms: durationMs,
  });
}

/**
 * Best-effort "what never ran" marker for the UI, walking forward from the failed node along
 * single, unconditional edges only — stopping at a fork (a filter node) or a dead end, since
 * beyond a fork it's ambiguous which branch would have executed had the run not failed first.
 * This is a visual hint, not a completeness guarantee: an unreached branch past a fork simply
 * isn't marked, rather than guessing.
 */
async function markUnreachableSkipped(
  supabase: ReturnType<typeof createServiceRoleSupabase>,
  runId: string,
  graph: WorkflowGraph,
  fromKey: string
) {
  const toSkip: StepDefinition[] = [];
  let key: string | null = nextNodeKey(graph, fromKey);
  const seen = new Set<string>([fromKey]);

  while (key && !seen.has(key)) {
    seen.add(key);
    const node = getNode(graph, key);
    if (!node) break;
    toSkip.push(toStepDefinition(node));
    if (node.type === "filter") break; // a fork — which branch would have run is ambiguous
    key = nextNodeKey(graph, key);
  }

  if (toSkip.length === 0) return;
  await supabase.from("workflow_run_steps").insert(
    toSkip.map((s) => ({
      run_id: runId,
      step_key: s.key,
      type: s.type,
      input: s.config,
      output: null,
      status: "skipped" as StepStatus,
      duration_ms: 0,
    }))
  );
}

async function finishRun(
  supabase: ReturnType<typeof createServiceRoleSupabase>,
  runId: string,
  status: "success" | "failed" | "stopped_by_filter"
) {
  await supabase.from("workflow_runs").update({ status, ended_at: new Date().toISOString() }).eq("id", runId);
}

// The schema (as specified) has no dedicated column for "which node to resume from" or
// "the run's accumulated context so far" — both are required to resume a paused run
// correctly. Rather than add a migration, we use a reserved key inside trigger_payload
// (`__resume__`) that's never a real trigger field, so no schema change is needed. The cron
// tick route reads it back out when resuming (see app/api/cron/tick/route.ts). Resume state
// is keyed by node KEY (not array index) now that execution follows graph edges, not a list.
// `resumeFromKey` is already resolved to the node AFTER the Delay step by the caller — may be
// null if the Delay step was the last node, meaning "nothing left to run, finish on resume."
async function pauseRun(
  supabase: ReturnType<typeof createServiceRoleSupabase>,
  runId: string,
  resumeAt: string,
  resumeFromKey: string | null,
  context: Record<string, any>
) {
  const { data: run } = await supabase.from("workflow_runs").select("trigger_payload").eq("id", runId).single();
  const basePayload = { ...(run?.trigger_payload || {}) };
  delete basePayload.__resume__;

  await supabase
    .from("workflow_runs")
    .update({
      status: "waiting",
      resume_at: resumeAt,
      trigger_payload: { ...basePayload, __resume__: { key: resumeFromKey, context } },
    })
    .eq("id", runId);
}

/**
 * Same reserved-key mechanism as pauseRun, but for retrying a step that just failed
 * transiently rather than a Delay step's deliberate wait. `retryAttempt` in the resume
 * payload distinguishes the two cases for the cron tick route: a plain __resume__ (no
 * retryAttempt) resumes at the node AFTER the one stored; a __resume__ with retryAttempt
 * re-runs the SAME node (the stored key points at it again).
 */
async function pauseForRetry(
  supabase: ReturnType<typeof createServiceRoleSupabase>,
  runId: string,
  stepKey: string,
  retryAttempt: number,
  backoffSeconds: number,
  context: Record<string, any>
) {
  const { data: run } = await supabase.from("workflow_runs").select("trigger_payload").eq("id", runId).single();
  const basePayload = { ...(run?.trigger_payload || {}) };
  delete basePayload.__resume__;

  await supabase
    .from("workflow_runs")
    .update({
      status: "waiting",
      resume_at: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
      trigger_payload: { ...basePayload, __resume__: { key: stepKey, context, retryAttempt } },
    })
    .eq("id", runId);
}

async function alertOwnerOfFailure(
  supabase: ReturnType<typeof createServiceRoleSupabase>,
  workflowId: string,
  runId: string,
  failedStepKey: string,
  error: string | undefined
) {
  const { data: workflow } = await supabase
    .from("workflows")
    .select("name, user_id")
    .eq("id", workflowId)
    .single();
  if (!workflow) return;

  // In-app notification — shown via the bell icon regardless of whether email delivery
  // works, so a failure is never invisible even if RESEND_API_KEY is misconfigured.
  await supabase.from("notifications").insert({
    user_id: workflow.user_id,
    title: `"${workflow.name}" failed`,
    body: `Failed at step "${failedStepKey}": ${error || "unknown error"}`,
    link: `/runs/${workflowId}/${runId}`,
  });

  const { data: owner } = await supabase.from("users").select("email").eq("id", workflow.user_id).single();
  if (!owner?.email) return;

  try {
    await sendAlertEmail(
      owner.email,
      `busigo: "${workflow.name}" failed at step "${failedStepKey}"`,
      `Your workflow "${workflow.name}" (run ${runId}) failed at step "${failedStepKey}".\n\nError: ${error || "unknown error"}\n\nView the full run trace in your busigo dashboard under Runs.`
    );
  } catch (e) {
    console.error("failed to send failure alert email", e);
  }
}
