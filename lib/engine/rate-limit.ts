import { createServiceRoleSupabase } from "@/lib/supabase/server";

// Hard Constraint 7: the inbound webhook and public form endpoints are unauthenticated
// and internet-facing. Cap how many runs a single workflow can start per rolling minute,
// checked against workflow_runs (no extra infra needed) — protects the account's credits
// and Claude API bill from a bad actor or a misconfigured retry loop.
const MAX_TRIGGERS_PER_MINUTE = 30;

export async function isRateLimited(workflowId: string): Promise<boolean> {
  const supabase = createServiceRoleSupabase();
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

  const { count, error } = await supabase
    .from("workflow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workflow_id", workflowId)
    .gte("started_at", oneMinuteAgo);

  if (error) {
    // Fail closed on a rate-limit check we couldn't perform — better to reject a trigger
    // than to let an unbounded loop through because of a transient DB error.
    console.error("rate-limit check failed", error);
    return true;
  }

  return (count ?? 0) >= MAX_TRIGGERS_PER_MINUTE;
}
