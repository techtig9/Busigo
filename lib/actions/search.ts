"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";

export interface SearchResult {
  workflows: { id: string; name: string; status: string; trigger_type: string }[];
  runs: { id: string; workflow_id: string; workflow_name: string; status: string; started_at: string }[];
}

const EMPTY: SearchResult = { workflows: [], runs: [] };

/**
 * Backs the dashboard top-nav search box. Uses the request-bound client (not service-role),
 * so Postgres RLS — not application code — is the real backstop scoping every result to the
 * signed-in user's own workspace; see the workspace-membership policies in
 * supabase/migrations/20260822090000_phase18_workspace_foundation.sql. The explicit
 * .eq("workspace_id", workspace.id) below is the same fast, friendly app-layer check used
 * throughout the codebase (see lib/workspace/authorize.ts) — not the only thing keeping
 * results scoped correctly, just a clearer failure and one less round-trip if it's ever
 * wrong. Previously this hand-rolled a *user_id* filter on workflows (but not runs) — meaning
 * a teammate's search results silently excluded colleagues' workflows in the same shared
 * workspace ever since Phase 1 introduced workspace-shared workflows; fixed here.
 *
 * Split into plain, individually well-supported filters (ilike, in) rather than one clever
 * combined query — a filter across a joined/embedded table inside a single .or() string is
 * exactly the kind of thing that *looks* right but is easy to get subtly wrong against real
 * PostgREST without a live instance to test against.
 */
export async function searchAction(rawQuery: string): Promise<SearchResult> {
  const query = rawQuery.trim();
  if (query.length < 2) return EMPTY;

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;
  const { workspace } = await getWorkspaceContext();

  const escaped = query.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const { data: matchedWorkflows } = await supabase
    .from("workflows")
    .select("id, name, status, trigger_type")
    .eq("workspace_id", workspace.id)
    .ilike("name", pattern)
    .order("created_at", { ascending: false })
    .limit(5);

  const matchedWorkflowIds = (matchedWorkflows || []).map((w) => w.id);

  const [{ data: runsByStatus }, { data: runsByWorkflow }] = await Promise.all([
    supabase
      .from("workflow_runs")
      .select("id, workflow_id, status, started_at, workflows!inner(name, workspace_id)")
      .eq("workflows.workspace_id", workspace.id)
      .ilike("status", pattern)
      .order("started_at", { ascending: false })
      .limit(5),
    matchedWorkflowIds.length > 0
      ? supabase
          .from("workflow_runs")
          .select("id, workflow_id, status, started_at, workflows(name)")
          .in("workflow_id", matchedWorkflowIds)
          .order("started_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const runMap = new Map<string, any>();
  for (const r of [...(runsByStatus || []), ...(runsByWorkflow || [])]) {
    runMap.set(r.id, r);
  }

  return {
    workflows: matchedWorkflows || [],
    runs: Array.from(runMap.values())
      .slice(0, 5)
      .map((r: any) => ({
        id: r.id,
        workflow_id: r.workflow_id,
        workflow_name: r.workflows?.name || "Unknown workflow",
        status: r.status,
        started_at: r.started_at,
      })),
  };
}
