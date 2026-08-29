import crypto from "node:crypto";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export function hashRequest(input: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function claimIdempotency(userId: string, key: string, requestHash: string, ttlMinutes = 30) {
  const supabase = createServiceRoleSupabase();
  const expires = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("idempotency_keys")
    .upsert({ user_id: userId, key, request_hash: requestHash, expires_at: expires }, { onConflict: "user_id,key", ignoreDuplicates: true })
    .select("response_status,response_body,request_hash,expires_at")
    .maybeSingle();
  if (error) throw error;
  if (data && data.request_hash !== requestHash) throw new Error("Idempotency key reused with a different request");
  if (data?.response_status && new Date(data.expires_at).getTime() > Date.now()) return data;
  return null;
}

export async function saveIdempotentResponse(userId: string, key: string, status: number, body: unknown) {
  const supabase = createServiceRoleSupabase();
  await supabase.from("idempotency_keys").update({ response_status: status, response_body: body }).eq("user_id", userId).eq("key", key);
}

export async function enqueueJob(userId: string, jobType: string, payload: unknown, idempotencyKey?: string) {
  const supabase = createServiceRoleSupabase();
  const { data, error } = await supabase.from("system_jobs").insert({ user_id: userId, job_type: jobType, payload, idempotency_key: idempotencyKey ?? null }).select("id,status").single();
  if (error) throw error;
  return data;
}

export async function recordPlatformMetric(name: string, value: number, dimensions: Record<string, unknown> = {}) {
  const supabase = createServiceRoleSupabase();
  await supabase.from("platform_metrics").insert({ metric_name: name, metric_value: value, dimensions });
}

export interface DeadLetterParams {
  workspaceId: string;
  workflowId: string;
  runId: string;
  stepKey: string;
  reason: string;
  payload: Record<string, unknown>;
}

/** Records a run/step that exhausted its retry budget — see lib/engine/retry.ts and executor.ts. */
export async function writeDeadLetter(params: DeadLetterParams) {
  const supabase = createServiceRoleSupabase();
  const { error } = await supabase.from("dead_letter_jobs").insert({
    workspace_id: params.workspaceId,
    workflow_id: params.workflowId,
    run_id: params.runId,
    step_key: params.stepKey,
    reason: params.reason,
    payload: params.payload,
  });
  if (error) console.error("writeDeadLetter failed:", error.message);
}
