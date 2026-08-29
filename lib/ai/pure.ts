// No "server-only" or Supabase import here on purpose — see the same note in
// lib/security/webhook-signing.ts. These are pure, deterministic functions
// used by lib/ai/provider.ts and lib/ai/observability.ts, and directly
// unit-tested in test/ai-pure.test.ts.

/**
 * Rough token estimate from character count (~4 chars/token for English) — good
 * enough for cost/credit observability, not meant to match a provider's exact
 * tokenizer.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const COOLDOWN_BASE_MINUTES = 5;
const COOLDOWN_CAP_MINUTES = 30;

/**
 * Cooldown escalates with repeated failures (5, 10, 15, ... minutes) and is
 * capped so a provider is never locked out for more than 30 minutes on the
 * strength of automated detection alone.
 */
export function computeCooldownMinutes(consecutiveFailures: number): number {
  return Math.min(COOLDOWN_BASE_MINUTES * Math.max(consecutiveFailures, 1), COOLDOWN_CAP_MINUTES);
}
