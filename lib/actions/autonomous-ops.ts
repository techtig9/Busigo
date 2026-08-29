"use server";

import { requireWorkspace } from "@/lib/workspace/authorize";
import { revalidatePath } from "next/cache";

export async function createAutonomyPolicyAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const name = String(formData.get("name") || "Business Safe Mode").trim();
  const maxRisk = String(formData.get("max_risk") || "low");
  const requiresApproval = formData.get("requires_approval") !== "false";
  const { error } = await supabase.from("autonomy_policies").upsert({
    user_id: userId, workspace_id: workspace.id, name, max_risk: maxRisk, requires_approval: requiresApproval,
    allowed_action_types: ["draft", "notify", "classify", "analyze"],
    blocked_action_types: ["move_money", "delete_data", "change_legal_terms", "publish_without_approval"],
  }, { onConflict: "workspace_id,name" });
  if (error) throw new Error(error.message);
  revalidatePath("/autonomous-ops");
}

export async function toggleAutonomyPolicyAction(id: string, enabled: boolean) {
  const { supabase, workspace } = await requireWorkspace("member");
  const { error } = await supabase.from("autonomy_policies").update({ enabled, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/autonomous-ops");
}

export async function createDecisionAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const title = String(formData.get("title") || "").trim();
  const rationale = String(formData.get("rationale") || "").trim();
  const risk = String(formData.get("risk_level") || "low");
  if (!title || !rationale) throw new Error("Decision title and rationale are required.");
  const { error } = await supabase.from("autonomous_decisions").insert({
    user_id: userId, workspace_id: workspace.id, title, rationale, risk_level: risk,
    requires_human_approval: risk !== "low", proposed_action: { mode: "draft_only" }, confidence: 0.75,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/autonomous-ops");
}

export async function resolveIncidentAction(id: string) {
  const { supabase, workspace } = await requireWorkspace("member");
  const { error } = await supabase.from("automation_incidents").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/autonomous-ops");
}

export async function markAlertReadAction(id: string) {
  const { supabase, workspace } = await requireWorkspace("member");
  const { error } = await supabase.from("business_alerts").update({ read: true }).eq("id", id).eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/autonomous-ops");
}

export async function verifyDecisionAction(id: string, verified: boolean) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const { data: decision, error: readError } = await supabase.from("autonomous_decisions").select("id,title,proposed_action").eq("id", id).eq("workspace_id", workspace.id).single();
  if (readError || !decision) throw new Error(readError?.message || "Decision not found.");
  const { error } = await supabase.from("action_verifications").insert({ user_id: userId, workspace_id: workspace.id, decision_id: decision.id, action_type: "decision_review", expected_result: decision.proposed_action || {}, observed_result: { review: verified ? "verified" : "rejected" }, verified, verification_method: "human_review" });
  if (error) throw new Error(error.message);
  revalidatePath("/autonomous-ops");
}
