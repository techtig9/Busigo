"use server";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace/authorize";

export async function createGovernancePolicyAction(fd: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const name = String(fd.get("name") || "").trim();
  const policyType = String(fd.get("policy_type") || "").trim();
  if (!name || !policyType) throw new Error("Policy name and type are required.");
  const { error } = await supabase.from("governance_policies").insert({ user_id: userId, workspace_id: workspace.id, name, policy_type: policyType, rules: { require_approval: fd.get("require_approval") === "on" } });
  if (error) throw new Error(error.message);
  await supabase.from("audit_logs").insert({ user_id: userId, workspace_id: workspace.id, action: "governance_policy.created", resource_type: "governance_policy", outcome: "success", metadata: { policyType } });
  revalidatePath("/security-governance");
}

export async function requestDataAction(fd: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const type = String(fd.get("request_type") || "export") as "export" | "delete" | "access_review";
  if (!["export", "delete", "access_review"].includes(type)) throw new Error("Invalid request type.");
  const { error } = await supabase.from("data_requests").insert({ user_id: userId, workspace_id: workspace.id, request_type: type, notes: "User-requested governance operation" });
  if (error) throw new Error(error.message);
  await supabase.from("audit_logs").insert({ user_id: userId, workspace_id: workspace.id, action: `data_request.${type}`, resource_type: "data_request", outcome: "success" });
  revalidatePath("/security-governance");
}
