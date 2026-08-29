"use server";
import { revalidatePath } from "next/cache";
import { runBusinessAI } from "@/lib/ai/provider";
import { requireWorkspace } from "@/lib/workspace/authorize";

export async function createGrowthPlanAction(fd: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const name = String(fd.get("name") || "").trim(), objective = String(fd.get("objective") || "").trim();
  if (!name || !objective) throw new Error("Name and objective are required.");
  const { error } = await supabase.from("growth_plans").insert({ user_id: userId, workspace_id: workspace.id, name, objective, target_metric: String(fd.get("target_metric") || "") || null, target_value: Number(fd.get("target_value") || 0) || null, horizon_days: Number(fd.get("horizon_days") || 30) });
  if (error) throw new Error(error.message);
  revalidatePath("/growth-engine");
}

export async function createGrowthCampaignAction(fd: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const name = String(fd.get("name") || "").trim(), channel = String(fd.get("channel") || "");
  if (!name) throw new Error("Campaign name is required.");
  const { error } = await supabase.from("growth_campaigns").insert({ user_id: userId, workspace_id: workspace.id, name, channel, objective: String(fd.get("objective") || "") || null, budget: Number(fd.get("budget") || 0) || null });
  if (error) throw new Error(error.message);
  revalidatePath("/growth-engine");
}

// Fully converted to workspace scoping this round (was partially done in Phase 2 — only the
// AI call itself had workspaceId, for gateway observability; the growth_plans/business_outcomes
// queries below were still user_id-scoped until now).
export async function generateGrowthStrategyAction() {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const [{ data: brain }, { data: plans }, { data: outcomes }, { data: recs }] = await Promise.all([
    supabase.from("businesses").select("*").eq("workspace_id", workspace.id).maybeSingle(),
    supabase.from("growth_plans").select("name,objective,status").eq("workspace_id", workspace.id).limit(10),
    supabase.from("business_outcomes").select("title,outcome_type,value").eq("workspace_id", workspace.id).limit(20),
    supabase.from("growth_recommendations").select("title,category,expected_impact").eq("workspace_id", workspace.id).limit(20),
  ]);
  const ai = await runBusinessAI({
    task: "Create a conservative 90-day growth strategy. Identify 3 highest-leverage plays, audience ideas, experiments and first actions. Never invent metrics.",
    context: { business: brain, plans, outcomes, recommendations: recs },
    schema: { plays: [{ title: "", why: "", channel: "", expected_impact: "", risk: "low|medium|high", first_action: "" }], audiences: [{ name: "", criteria: "" }], experiments: [{ name: "", hypothesis: "", metric: "" }] },
    workspaceId: workspace.id,
  });
  const { error } = await supabase.from("growth_plans").insert({ user_id: userId, workspace_id: workspace.id, name: "AI 90-Day Growth Strategy", objective: "Increase sustainable growth", horizon_days: 90, status: "draft", strategy: ai.result });
  if (error) throw new Error(error.message);
  revalidatePath("/growth-engine");
}
