"use server";

import { requireWorkspace } from "@/lib/workspace/authorize";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Converted to workspace scoping (Master Spec section 2), following the pattern set in
// lib/actions/workflows.ts: a workspace's Business Brain profile, discovery answers, and AI
// Workforce roster are now shared by the whole team, not siloed per individual member — the
// unique constraints these upserts rely on were moved to workspace_id in
// supabase/migrations/20260823090000_phase21_workspace_scope_sweep.sql.

function splitList(value: FormDataEntryValue | null) {
  return String(value || "").split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
}

export async function saveBusinessProfileAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const payload = {
    user_id: userId,
    workspace_id: workspace.id,
    name: String(formData.get("name") || "").trim(),
    industry: String(formData.get("industry") || "").trim(),
    business_model: String(formData.get("business_model") || "").trim(),
    website: String(formData.get("website") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    target_customer: String(formData.get("target_customer") || "").trim() || null,
    country: String(formData.get("country") || "").trim() || null,
    team_size: Number(formData.get("team_size") || 0) || null,
    monthly_revenue: Number(formData.get("monthly_revenue") || 0) || null,
    currency: String(formData.get("currency") || "USD").trim(),
    legal_name: String(formData.get("legal_name") || "").trim() || null,
    business_type: String(formData.get("business_type") || "").trim() || null,
    locations: splitList(formData.get("locations")),
    markets: splitList(formData.get("markets")),
    languages: splitList(formData.get("languages")),
    products: splitList(formData.get("products")),
    services: splitList(formData.get("services")),
    customer_segments: splitList(formData.get("customer_segments")),
    acquisition_channels: splitList(formData.get("acquisition_channels")),
    sales_channels: splitList(formData.get("sales_channels")),
    departments: splitList(formData.get("departments")),
    team_roles: splitList(formData.get("team_roles")),
    brand_voice: String(formData.get("brand_voice") || "").trim() || null,
    financial_snapshot: {
      annual_revenue: String(formData.get("annual_revenue") || "").trim() || null,
      gross_margin: String(formData.get("gross_margin") || "").trim() || null,
      monthly_marketing_spend: String(formData.get("monthly_marketing_spend") || "").trim() || null,
      monthly_software_spend: String(formData.get("monthly_software_spend") || "").trim() || null,
      average_order_value: String(formData.get("average_order_value") || "").trim() || null,
      customer_acquisition_cost: String(formData.get("customer_acquisition_cost") || "").trim() || null,
      customer_lifetime_value: String(formData.get("customer_lifetime_value") || "").trim() || null,
    },
  };
  if (!payload.name || !payload.industry) throw new Error("Business name and industry are required.");
  const { error } = await supabase.from("businesses").upsert(payload, { onConflict: "workspace_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/business-brain");
  redirect("/business-brain?onboarding=profile-saved");
}

export async function saveDiscoveryAnswerAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const key = String(formData.get("key") || "").trim();
  const answer = String(formData.get("answer") || "").trim();
  if (!key || !answer) throw new Error("Answer is required.");
  const { error } = await supabase.from("business_discovery_answers").upsert({ user_id: userId, workspace_id: workspace.id, question_key: key, answer }, { onConflict: "workspace_id,question_key" });
  if (error) throw new Error(error.message);
  revalidatePath("/business-brain");
}

export async function createOpportunityAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const impact = String(formData.get("impact") || "high");
  const effort = String(formData.get("effort") || "low");
  const score = Number(formData.get("priority_score") || 0);
  if (!title) throw new Error("Opportunity title is required.");
  const { error } = await supabase.from("automation_opportunities").insert({ user_id: userId, workspace_id: workspace.id, title, description, impact, effort, priority_score: score || 50, source: "user" });
  if (error) throw new Error(error.message);
  revalidatePath("/opportunities");
}

export async function updateApprovalAction(id: string, decision: "approved" | "rejected") {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const { error } = await supabase.from("ai_approvals").update({ status: decision, decided_at: new Date().toISOString(), decided_by: userId }).eq("id", id).eq("workspace_id", workspace.id).eq("status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/approvals");
}

export async function seedRecommendedAgentsAction() {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const agents = [
    ["Chief of Staff", "orchestrator", "Monitors business health, coordinates agents and prepares daily decisions."],
    ["Sales Agent", "sales", "Qualifies leads, prepares follow-ups and keeps sales systems updated."],
    ["Customer Support Agent", "support", "Classifies and drafts support responses using approved business knowledge."],
    ["Marketing Agent", "marketing", "Plans campaigns, content and growth experiments for approval."],
    ["Operations Agent", "operations", "Coordinates repetitive operational work and escalations."],
    ["Finance Agent", "finance", "Monitors invoices, cash-flow signals and finance workflows without moving money automatically."],
    ["Data Analyst", "analytics", "Explains KPI changes, anomalies and business trends."],
  ].map(([name, type, description]) => ({ user_id: userId, workspace_id: workspace.id, name, agent_type: type, description, status: "draft", autonomy_level: "approval_required" }));
  const { error } = await supabase.from("ai_agents").upsert(agents, { onConflict: "workspace_id,agent_type" });
  if (error) throw new Error(error.message);
  revalidatePath("/workforce");
}

export async function setAgentPolicyAction(agentId: string, autonomyLevel: "approval_required" | "low_risk_auto", status: "draft" | "active" | "paused" | "error") {
  const { supabase, workspace } = await requireWorkspace("member");
  const { error } = await supabase.from("ai_agents").update({ autonomy_level: autonomyLevel, status }).eq("id", agentId).eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/workforce");
  revalidatePath("/autonomous-ops");
}
