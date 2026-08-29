import "server-only";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { CREDIT_COSTS, CREDIT_COST_CEILING_USD } from "@/lib/pricing";
import { computeCooldownMinutes } from "./pure";
import type { AIProviderName } from "./provider";

export type AIErrorClass = "quota_or_rate_limit" | "auth_error" | "invalid_response" | "network_error" | "other";

export interface AIEventLog {
  workspaceId: string;
  requestId: string;
  provider: AIProviderName;
  model: string;
  /** A short label like "automation_plan" or "copilot_chat" — never the actual prompt or account data. */
  task: string;
  status: "started" | "succeeded" | "failed";
  latencyMs?: number;
  inputTokensEstimate?: number;
  outputTokensEstimate?: number;
  /** Set when this attempt only happened because an earlier provider in the order failed over to it. */
  failoverReason?: string;
  errorClass?: AIErrorClass;
}

/** Re-exported so existing importers of estimateTokens from this file keep working — the
 * real implementation lives in ./pure so it stays testable without pulling in "server-only". */
export { estimateTokens } from "./pure";

/**
 * Writes one row per provider attempt — including attempts that failed over to
 * the next provider, not just the final winner — so the AI Studio health
 * dashboard can show real failover counts and error breakdowns, not just
 * successes. Deliberately logs a task LABEL and token/character counts only,
 * never the prompt or account-context content itself (input_summary/
 * output_summary below are short, human-readable labels, not raw payloads).
 */
export async function logAIProviderEvent(event: AIEventLog): Promise<void> {
  const admin = createServiceRoleSupabase();
  const creditsConsumed = event.status === "succeeded" ? CREDIT_COSTS.AI_ACTION_STEP : 0;
  const { error } = await admin.from("ai_provider_events").insert({
    // user_id is nullable as of phase19 — the gateway logs every attempt from call sites
    // that don't always have a single acting user in scope; workspace_id is the tenant key.
    workspace_id: event.workspaceId,
    request_id: event.requestId,
    provider: event.provider,
    model: event.model,
    event_type: event.task,
    status: event.status,
    latency_ms: event.latencyMs ?? null,
    input_tokens: event.inputTokensEstimate ?? null,
    output_tokens: event.outputTokensEstimate ?? null,
    failover_reason: event.failoverReason ?? null,
    error_class: event.errorClass ?? null,
    credits_consumed: creditsConsumed,
    cost_estimate_usd: creditsConsumed * CREDIT_COST_CEILING_USD,
  });
  if (error) console.error("logAIProviderEvent failed:", error.message);
}

/**
 * Marks a provider as cooling down after a quota/rate-limit response, so the
 * next request skips straight past it instead of wasting a round trip on a
 * provider we already know is exhausted. Cooldown escalates on repeated
 * failures (5 / 10 / 15 / ... min, capped at 30) and resets on success.
 */
export async function recordProviderFailure(provider: AIProviderName, message: string): Promise<void> {
  const admin = createServiceRoleSupabase();
  const { data: existing } = await admin.from("ai_provider_cooldowns").select("consecutive_failures").eq("provider", provider).maybeSingle();
  const failures = (existing?.consecutive_failures ?? 0) + 1;
  const minutes = computeCooldownMinutes(failures);
  const coolingDownUntil = new Date(Date.now() + minutes * 60_000).toISOString();

  await admin.from("ai_provider_cooldowns").upsert(
    { provider, cooling_down_until: coolingDownUntil, last_error: message.slice(0, 500), consecutive_failures: failures, updated_at: new Date().toISOString() },
    { onConflict: "provider" }
  );
}

export async function recordProviderSuccess(provider: AIProviderName): Promise<void> {
  const admin = createServiceRoleSupabase();
  await admin.from("ai_provider_cooldowns").upsert(
    { provider, cooling_down_until: null, consecutive_failures: 0, updated_at: new Date().toISOString() },
    { onConflict: "provider" }
  );
}

export interface ProviderCooldownState {
  provider: AIProviderName;
  coolingDownUntil: string | null;
  isActive: boolean;
  lastError: string | null;
}

/**
 * Cooldown is a soft signal, not a hard block: callers use this to REORDER
 * providers (try known-healthy ones first) but should still fall through to a
 * cooling-down provider if every other option is also unavailable — a
 * predicted rate limit is sometimes wrong, and a fully-blocked gateway is
 * worse than one occasional wasted call.
 */
export async function getProviderCooldowns(): Promise<ProviderCooldownState[]> {
  const admin = createServiceRoleSupabase();
  const { data } = await admin.from("ai_provider_cooldowns").select("provider, cooling_down_until, last_error");
  const now = Date.now();
  return (data ?? []).map((row) => ({
    provider: row.provider as AIProviderName,
    coolingDownUntil: row.cooling_down_until,
    isActive: Boolean(row.cooling_down_until && new Date(row.cooling_down_until).getTime() > now),
    lastError: row.last_error,
  }));
}

export interface WorkspaceAIStats {
  provider: AIProviderName;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  failoverCount: number;
  avgLatencyMs: number | null;
  lastSuccessAt: string | null;
  last24hCost: number;
}

/** Per-workspace usage stats for the AI Studio health dashboard, over the last 30 days. */
export async function getWorkspaceAIStats(workspaceId: string): Promise<WorkspaceAIStats[]> {
  const admin = createServiceRoleSupabase();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const { data } = await admin
    .from("ai_provider_events")
    .select("provider, status, latency_ms, failover_reason, cost_estimate_usd, created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", since);

  const rows = data ?? [];
  const byProvider = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byProvider.get(row.provider) ?? [];
    list.push(row);
    byProvider.set(row.provider, list);
  }

  return Array.from(byProvider.entries()).map(([provider, events]) => {
    const successes = events.filter((e) => e.status === "succeeded");
    const failures = events.filter((e) => e.status === "failed");
    const latencies = successes.map((e) => e.latency_ms).filter((v): v is number => typeof v === "number");
    const lastSuccess = successes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const dayAgo = Date.now() - 24 * 60 * 60_000;

    return {
      provider: provider as AIProviderName,
      totalCalls: events.length,
      successCount: successes.length,
      failureCount: failures.length,
      failoverCount: events.filter((e) => e.failover_reason).length,
      avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
      lastSuccessAt: lastSuccess?.created_at ?? null,
      last24hCost: events.filter((e) => new Date(e.created_at).getTime() > dayAgo).reduce((sum, e) => sum + (e.cost_estimate_usd ?? 0), 0),
    };
  });
}
