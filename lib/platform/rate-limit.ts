import "server-only";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Generic fixed-window rate limiter on rate_limit_buckets (created in phase14's
 * scale-reliability migration, never used by anything until now — lib/engine/rate-limit.ts
 * has its own narrower, workflow-run-count-specific check for trigger endpoints; this is the
 * general-purpose one for everything else, starting with auth brute-force protection below).
 *
 * `subjectKey` scopes who's being limited (e.g. an email or IP), `bucketKey` scopes what
 * they're being limited on (e.g. "login_attempt") — the pair must be unique per window.
 * Windows are fixed, not sliding: a burst right at a window boundary can technically allow
 * close to 2x the limit in a short span. That's an accepted, deliberate simplification for a
 * brute-force *deterrent*, not a hard security boundary — Supabase Auth's own server-side
 * throttling is the actual backstop against a truly determined attacker.
 */
export async function checkRateLimit(subjectKey: string, bucketKey: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const supabase = createServiceRoleSupabase();
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();

  const { data: existing } = await supabase
    .from("rate_limit_buckets")
    .select("id, request_count, window_started_at")
    .eq("subject_key", subjectKey)
    .eq("bucket_key", bucketKey)
    .maybeSingle();

  if (!existing || existing.window_started_at !== windowStart) {
    // First request in this window (or the previous window has rolled over) — reset the count.
    await supabase.from("rate_limit_buckets").upsert(
      { subject_key: subjectKey, bucket_key: bucketKey, window_started_at: windowStart, request_count: 1, limit_count: limit, updated_at: new Date().toISOString() },
      { onConflict: "subject_key,bucket_key" }
    );
    return { allowed: true, remaining: limit - 1 };
  }

  if (existing.request_count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await supabase
    .from("rate_limit_buckets")
    .update({ request_count: existing.request_count + 1, updated_at: new Date().toISOString() })
    .eq("id", existing.id);

  return { allowed: true, remaining: limit - existing.request_count - 1 };
}
