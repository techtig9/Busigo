"use server";

import { requireWorkspace } from "@/lib/workspace/authorize";
import { revalidatePath } from "next/cache";

export async function saveAgentPermissionsAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const agentId = String(formData.get("agent_id") || "");
  const permissions = JSON.parse(String(formData.get("permissions") || "[]"));
  if (!agentId || !Array.isArray(permissions)) throw new Error("Invalid agent permission payload.");
  const { error: deleteError } = await supabase.from("agent_permissions").delete().eq("workspace_id", workspace.id).eq("agent_id", agentId);
  if (deleteError) throw new Error(deleteError.message);
  if (permissions.length) {
    const rows = permissions.map((p: any) => ({
      user_id: userId,
      workspace_id: workspace.id,
      agent_id: agentId,
      capability: String(p.capability),
      resource: String(p.resource),
      allowed: Boolean(p.allowed),
      requires_approval: Boolean(p.requires_approval),
    }));
    const { error } = await supabase.from("agent_permissions").insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/workforce");
}

export async function createAgentTaskAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const agentId = String(formData.get("agent_id") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const priority = String(formData.get("priority") || "medium");
  if (!agentId || !title) throw new Error("Agent and task title are required.");
  const { error } = await supabase.from("agent_tasks").insert({ user_id: userId, workspace_id: workspace.id, agent_id: agentId, title, description: description || null, priority, input: { source: "workforce-command-center" } });
  if (error) throw new Error(error.message);
  revalidatePath("/workforce");
}

export async function handoffAgentTaskAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const agentId = String(formData.get("agent_id") || "");
  const taskId = String(formData.get("task_id") || "") || null;
  const reason = String(formData.get("reason") || "Human review requested").trim();
  if (!agentId) throw new Error("Agent is required.");
  const { error } = await supabase.from("agent_handoffs").insert({ user_id: userId, workspace_id: workspace.id, agent_id: agentId, task_id: taskId, reason, context: { requested_from: "agent-command-center" } });
  if (error) throw new Error(error.message);
  if (taskId) await supabase.from("agent_tasks").update({ status: "handed_off", updated_at: new Date().toISOString() }).eq("id", taskId).eq("workspace_id", workspace.id);
  revalidatePath("/workforce");
}

export async function completeAgentTaskAction(taskId: string) {
  const { supabase, workspace } = await requireWorkspace("member");
  const { error } = await supabase.from("agent_tasks").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", taskId).eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/workforce");
}
