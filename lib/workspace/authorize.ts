import "server-only";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext, type WorkspaceContext } from "./context";
import { roleAtLeast, type WorkspaceRole } from "./roles";

/**
 * Standard guard for workspace-scoped server actions. Resolves the caller's
 * Supabase client, user, and active workspace, and throws a friendly error if
 * their role doesn't meet minRole.
 *
 * This is a fast, UX-friendly failure — it is NOT the security boundary by
 * itself. Every workspace-scoped table also enforces the identical rule via
 * Postgres RLS (workspace_role_at_least(...)), so a bug here (or an action
 * some future page forgets to call this in) still cannot leak or corrupt
 * another workspace's data. Never treat this check as sufficient on its own
 * when writing new actions — always let RLS also do its job.
 */
export async function requireWorkspace(minRole: WorkspaceRole = "member") {
  const supabase = createServerSupabase();
  const ctx = await getWorkspaceContext();
  if (!roleAtLeast(ctx.role, minRole)) {
    throw new Error(`This action requires the ${minRole} role or higher in this workspace.`);
  }
  return { supabase, ...ctx };
}

/** Same as requireWorkspace but for a specific, already-known workspace id (e.g. accepting an invite before the switcher cookie is set). */
export async function requireWorkspaceById(workspaceId: string, minRole: WorkspaceRole = "member") {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!membership || !roleAtLeast(membership.role as WorkspaceRole, minRole)) {
    throw new Error(`This action requires the ${minRole} role or higher in this workspace.`);
  }
  return { supabase, userId: user.id, role: membership.role as WorkspaceRole };
}

export interface AuditLogParams {
  workspaceId: string;
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
}

/**
 * Writes a workspace_audit_log row via the service-role client. Deliberately
 * bypasses RLS: workspace_audit_log has no user insert policy (only a read
 * policy for members), by design — audit entries must be written exactly
 * once by trusted server code, never directly by a client-influenced insert,
 * or a compromised session could scrub its own trail.
 */
export async function writeAuditLog(params: AuditLogParams) {
  const admin = createServiceRoleSupabase();
  const { error } = await admin.from("workspace_audit_log").insert({
    workspace_id: params.workspaceId,
    actor_id: params.actorId,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    metadata: params.metadata ?? {},
  });
  // Audit logging failures should never block the action that triggered them
  // (a full audit_log table shouldn't take down billing) — log and move on.
  if (error) console.error("writeAuditLog failed:", error.message);
}

export type { WorkspaceContext };
