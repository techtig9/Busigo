// No "server-only" or Supabase import — pure, deterministic functions used by
// lib/engine/executor.ts, directly unit-tested in test/retry.test.ts.

export const MAX_STEP_RETRY_ATTEMPTS = 3;

/**
 * Backoff in seconds before retrying a step, by attempt number (1-indexed:
 * this is the delay before the Nth retry). 30s, 5min, 20min — short enough
 * that a genuinely transient blip recovers fast, long enough that a
 * struggling downstream service gets real room to recover instead of being
 * hammered again almost immediately.
 */
export function computeStepBackoffSeconds(attempt: number): number {
  const schedule = [30, 300, 1200];
  return schedule[Math.min(Math.max(attempt, 1), schedule.length) - 1];
}

export interface StepFailureInfo {
  stepType: string;
  /** The step handler's `output` on failure — http_request sets { status } when it got an HTTP response at all. */
  output: unknown;
  error?: string;
}

/**
 * Whether a failed step is worth automatically retrying, mirroring the same
 * philosophy as the AI gateway's quota/rate-limit-vs-other distinction
 * (lib/ai/provider.ts): retry failures that look transient or explicitly
 * signal "try again later," never failures that look like a permanent
 * problem with the step's own configuration — retrying those would just
 * waste attempts and delay the failure notification for no benefit.
 *
 * Currently scoped to http_request, the step type actually prone to
 * transient network conditions. send_email goes through Resend, which
 * already retries transient delivery failures server-side before this step
 * ever sees an error; ai_action goes through the AI gateway, which already
 * has its own provider-level failover — retrying the whole step on top of
 * that would compound backoff on backoff. Other step types (filter,
 * transform_data, webhook_response, delay) don't make external calls at all,
 * so a failure there is a configuration/logic problem, not a transient one.
 */
export function isRetryableStepFailure(info: StepFailureInfo): boolean {
  if (info.stepType !== "http_request") return false;

  // The SSRF guard, self-trigger guard, and "invalid URL" checks in http-request.ts all
  // reject BEFORE ever making a request, with output: null and an error starting with
  // "Blocked" or "Invalid URL" — same as a genuine network failure by shape, but a fully
  // permanent problem: retrying a request that's blocked for targeting a private IP range
  // will be blocked identically on every retry. These must never be classified as
  // retryable, or a security-guard rejection would silently retry 3 times and delay the
  // (permanent) failure notification for no reason.
  if (info.error && /^(Blocked|Invalid URL)/.test(info.error)) return false;

  const output = info.output as { status?: number } | null;
  if (!output || typeof output.status !== "number") {
    // No HTTP response at all (network error, DNS failure, our own 8s timeout) —
    // genuinely unknown whether the other side even received the request.
    return true;
  }

  const status = output.status;
  if (status === 429) return true; // explicit "you're going too fast, try later"
  if (status >= 500) return true; // server-side failure, likely transient
  return false; // 4xx other than 429: a config/auth/validation problem retrying won't fix
}
