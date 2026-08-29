import "server-only";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import type { WorkspaceRole } from "./roles";

export const WORKSPACE_COOKIE = "bg_workspace_id";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_personal: boolean;
}

export interface WorkspaceContext {
  workspace: WorkspaceSummary;
  role: WorkspaceRole;
  userId: string;
}

type MembershipRow = { workspace_id: string; role: WorkspaceRole; workspaces: WorkspaceSummary | WorkspaceSummary[] };

function normalizeWorkspace(row: MembershipRow): WorkspaceSummary {
  // The Supabase JS client returns embedded one-to-one relationships as an object,
  // but its TS types describe them as an array in some client versions — handle both.
  return Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
}

/**
 * Resolves the signed-in user's active workspace + role for this request.
 *
 * Reads the `bg_workspace_id` cookie set by switchWorkspaceAction. If it's
 * missing, stale, or points to a workspace the user is no longer a member of,
 * falls back to whichever workspace they joined first (their personal
 * workspace, for everyone who hasn't been invited elsewhere).
 *
 * The membership query relies entirely on RLS ("members can read workspace
 * membership" -> is_workspace_member(workspace_id)) to scope results to the
 * caller — there is no explicit .eq("user_id", ...) here because the RLS
 * policy already guarantees a user can only ever see their own membership
 * rows through the anon/authenticated client.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const cookieStore = cookies();
  const requestedId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  let membership: MembershipRow | null = null;

  if (requestedId) {
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, workspaces(id, name, slug, plan, is_personal)")
      .eq("workspace_id", requestedId)
      .maybeSingle();
    membership = data as MembershipRow | null;
  }

  if (!membership) {
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, workspaces(id, name, slug, plan, is_personal)")
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    membership = data as MembershipRow | null;
  }

  if (!membership) {
    throw new Error("No workspace found for this account. Contact support if this persists.");
  }

  return {
    workspace: normalizeWorkspace(membership),
    role: membership.role,
    userId: user.id,
  };
}

/** All workspaces the signed-in user belongs to, for the workspace switcher. */
export async function listMyWorkspaces(): Promise<Array<{ role: WorkspaceRole; workspace: WorkspaceSummary }>> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug, plan, is_personal)")
    .order("joined_at", { ascending: true });

  return ((data ?? []) as MembershipRow[]).map((row) => ({
    role: row.role,
    workspace: normalizeWorkspace(row),
  }));
}
