import { createServiceRoleSupabase } from "@/lib/supabase/server";

// Hard Constraint 9: an HTTP Request step can point at its own workflow's webhook URL,
// directly or through a chain of other workflows, creating an unbounded billable loop.
// Two independent protections:
//   1. Reject an http_request step whose target resolves to THIS workflow's own trigger URL.
//   2. Hard-cap total steps executed in a single run, regardless of cause.
export const MAX_STEPS_PER_RUN = 25;

export async function targetsOwnWebhook(url: string, workflowId: string): Promise<boolean> {
  try {
    const target = new URL(url);
    const supabase = createServiceRoleSupabase();
    const { data: workflow } = await supabase
      .from("workflows")
      .select("trigger_token")
      .eq("id", workflowId)
      .single();

    if (!workflow?.trigger_token) return false;
    // The public webhook path is always /api/hook/[token] — a self-reference means the
    // outbound URL's path contains this workflow's own token, regardless of host aliasing.
    return target.pathname.includes(`/api/hook/${workflow.trigger_token}`);
  } catch {
    // An unparseable URL is rejected separately by the HTTP Request step itself.
    return false;
  }
}
