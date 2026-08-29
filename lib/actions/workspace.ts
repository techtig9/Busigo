"use server";

import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext, listMyWorkspaces, WORKSPACE_COOKIE } from "@/lib/workspace/context";
import { requireWorkspace, writeAuditLog } from "@/lib/workspace/authorize";
import { WORKSPACE_ROLES, type WorkspaceRole } from "@/lib/workspace/roles";
import { sendAlertEmail } from "@/lib/engine/steps/send-email";
import { PLAN_CREDITS } from "@/lib/plans";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function slugify(name: string) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "workspace"}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function myWorkspacesAction() {
  return listMyWorkspaces();
}

export async function createWorkspaceAction(formData: FormData): Promise<ActionResult> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Workspace name is required." };

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name, slug: slugify(name), owner_id: user.id, is_personal: false })
    .select("id")
    .single();
  if (error || !workspace) return { error: error?.message || "Could not create workspace." };

  // Insert uses the service-role client: the caller isn't a member of the brand-new
  // workspace yet at the instant of this insert, so the "admins can manage membership"
  // RLS policy on workspace_members (which requires existing membership) would reject
  // it via the anon-key client. This is the one deliberate bootstrap exception.
  const admin = createServiceRoleSupabase();
  await admin.from("workspace_members").insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });
  // Every workspace needs a subscription row — canUseFeature/deductRunCredits (lib/plans.ts)
  // look up the workspace's plan/credits by workspace_id and find nothing without this.
  // Personal workspaces get one at signup (lib/actions/auth.ts, app/auth/callback/route.ts);
  // this covers workspaces created afterward via this action.
  await admin.from("subscriptions").insert({
    user_id: user.id,
    workspace_id: workspace.id,
    plan: "free",
    status: "active",
    credits_remaining: PLAN_CREDITS.free,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "workspace.created",
    targetType: "workspace",
    targetId: workspace.id,
    metadata: { name },
  });

  cookies().set(WORKSPACE_COOKIE, workspace.id, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/dashboard");
  return { success: true };
}

export async function switchWorkspaceAction(workspaceId: string): Promise<ActionResult> {
  const supabase = createServerSupabase();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!membership) return { error: "You're not a member of that workspace." };

  cookies().set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
  return { success: true };
}

export async function listMembersAction() {
  const { supabase, workspace } = await requireWorkspace("viewer");
  const { data } = await supabase
    .from("workspace_members")
    .select("id, role, joined_at, users(id, name, email)")
    .eq("workspace_id", workspace.id)
    .order("joined_at", { ascending: true });
  return data ?? [];
}

export async function listInvitationsAction() {
  const { supabase, workspace } = await requireWorkspace("viewer");
  const { data } = await supabase
    .from("workspace_invitations")
    .select("id, email, role, status, created_at, expires_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function inviteMemberAction(formData: FormData): Promise<ActionResult> {
  const { supabase, workspace, userId } = await requireWorkspace("admin");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "member") as WorkspaceRole;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!WORKSPACE_ROLES.includes(role)) return { error: "Unknown role." };
  if (role === "owner") return { error: "Ownership is transferred, not assigned via invitation." };

  const { data: invitation, error } = await supabase
    .from("workspace_invitations")
    .insert({ workspace_id: workspace.id, email, role, invited_by: userId })
    .select("id, token")
    .single();
  if (error || !invitation) return { error: error?.message || "Could not create the invitation." };

  await writeAuditLog({
    workspaceId: workspace.id,
    actorId: userId,
    action: "invitation.created",
    targetType: "workspace_invitation",
    targetId: invitation.id,
    metadata: { email, role },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/invite/${invitation.token}`;
  try {
    await sendAlertEmail(email, `You've been invited to join ${workspace.name} on BusiGo`, `Join here: ${inviteUrl}`);
  } catch (e: any) {
    // Invitation row exists either way — email delivery failing shouldn't block the invite.
    console.error("invitation email failed:", e.message);
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  const { supabase, workspace, userId } = await requireWorkspace("admin");
  const { error } = await supabase
    .from("workspace_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };

  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "invitation.revoked", targetType: "workspace_invitation", targetId: invitationId });
  revalidatePath("/settings");
  return { success: true };
}

export async function acceptInvitationAction(token: string): Promise<ActionResult> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first, then open your invitation link again." };

  // Service-role client: the invitee isn't a member of the target workspace yet, so
  // RLS would hide the invitation row (and reject the membership insert) via the
  // anon-key client. The token itself — a random uuid, emailed only to the invitee —
  // is the authorization check here, done explicitly below.
  const admin = createServiceRoleSupabase();
  const { data: invitation } = await admin
    .from("workspace_invitations")
    .select("id, workspace_id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invitation || invitation.status !== "pending") return { error: "This invitation is no longer valid." };
  if (new Date(invitation.expires_at) < new Date()) return { error: "This invitation has expired." };
  if (invitation.email !== user.email?.toLowerCase()) {
    return { error: "This invitation was sent to a different email address." };
  }

  await admin
    .from("workspace_members")
    .upsert({ workspace_id: invitation.workspace_id, user_id: user.id, role: invitation.role }, { onConflict: "workspace_id,user_id" });
  await admin.from("workspace_invitations").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invitation.id);

  await writeAuditLog({ workspaceId: invitation.workspace_id, actorId: user.id, action: "invitation.accepted", targetType: "workspace_invitation", targetId: invitation.id });

  cookies().set(WORKSPACE_COOKIE, invitation.workspace_id, { httpOnly: true, sameSite: "lax", path: "/" });
  return { success: true };
}

export async function changeMemberRoleAction(memberId: string, role: WorkspaceRole): Promise<ActionResult> {
  const { supabase, workspace, userId } = await requireWorkspace("admin");
  if (!WORKSPACE_ROLES.includes(role)) return { error: "Unknown role." };

  const { data: target } = await supabase.from("workspace_members").select("user_id, role").eq("id", memberId).eq("workspace_id", workspace.id).maybeSingle();
  if (!target) return { error: "Member not found." };

  if (target.role === "owner" && role !== "owner") {
    const { count } = await supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("role", "owner");
    if ((count ?? 0) <= 1) return { error: "A workspace must always have at least one owner. Transfer ownership first." };
  }
  if (role === "owner") return { error: "Use transferOwnershipAction to change the owner." };

  const { error } = await supabase.from("workspace_members").update({ role }).eq("id", memberId).eq("workspace_id", workspace.id);
  if (error) return { error: error.message };

  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "member.role_changed", targetType: "workspace_member", targetId: memberId, metadata: { role } });
  revalidatePath("/settings");
  return { success: true };
}

export async function removeMemberAction(memberId: string): Promise<ActionResult> {
  const { supabase, workspace, userId } = await requireWorkspace("admin");
  const { data: target } = await supabase.from("workspace_members").select("role").eq("id", memberId).eq("workspace_id", workspace.id).maybeSingle();
  if (!target) return { error: "Member not found." };
  if (target.role === "owner") return { error: "Transfer ownership before removing the current owner." };

  const { error } = await supabase.from("workspace_members").delete().eq("id", memberId).eq("workspace_id", workspace.id);
  if (error) return { error: error.message };

  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "member.removed", targetType: "workspace_member", targetId: memberId });
  revalidatePath("/settings");
  return { success: true };
}

export async function transferOwnershipAction(newOwnerMemberId: string): Promise<ActionResult> {
  const { supabase, workspace, userId } = await requireWorkspace("owner");
  const { data: target } = await supabase.from("workspace_members").select("id, user_id").eq("id", newOwnerMemberId).eq("workspace_id", workspace.id).maybeSingle();
  if (!target) return { error: "Member not found." };

  const { error: e1 } = await supabase.from("workspace_members").update({ role: "owner" }).eq("id", newOwnerMemberId);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase.from("workspace_members").update({ role: "admin" }).eq("workspace_id", workspace.id).eq("user_id", userId);
  if (e2) return { error: e2.message };
  await supabase.from("workspaces").update({ owner_id: target.user_id }).eq("id", workspace.id);

  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "workspace.ownership_transferred", targetType: "workspace_member", targetId: newOwnerMemberId });
  revalidatePath("/settings");
  return { success: true };
}
