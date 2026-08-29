"use server";

import { requireWorkspace } from "@/lib/workspace/authorize";
import { revalidatePath } from "next/cache";

export async function recordOutcomeAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const title = String(formData.get("title") || "").trim();
  const outcomeType = String(formData.get("outcome_type") || "other");
  const value = Number(formData.get("value") || 0);
  const unit = String(formData.get("unit") || "").trim() || null;
  if (!title || !Number.isFinite(value)) throw new Error("Outcome title and numeric value are required.");
  const { error } = await supabase.from("business_outcomes").insert({ user_id: userId, workspace_id: workspace.id, title, outcome_type: outcomeType, value, unit, source: "manual" });
  if (error) throw new Error(error.message);
  revalidatePath("/insights");
  revalidatePath("/growth");
}

export async function createGrowthRecommendationAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "other");
  const description = String(formData.get("description") || "").trim();
  const effort = String(formData.get("effort") || "medium");
  const expectedImpact = Number(formData.get("expected_impact") || 0);
  if (!title || !description) throw new Error("Recommendation title and description are required.");
  const { error } = await supabase.from("growth_recommendations").insert({ user_id: userId, workspace_id: workspace.id, title, category, description, effort, expected_impact: Number.isFinite(expectedImpact) ? expectedImpact : 0, confidence: 0.75 });
  if (error) throw new Error(error.message);
  revalidatePath("/growth");
}

export async function createExperimentAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const name = String(formData.get("name") || "").trim();
  const hypothesis = String(formData.get("hypothesis") || "").trim();
  const metric = String(formData.get("metric") || "").trim();
  const baseline = Number(formData.get("baseline") || 0);
  const target = Number(formData.get("target") || 0);
  if (!name || !hypothesis || !metric) throw new Error("Experiment name, hypothesis and metric are required.");
  const { error } = await supabase.from("growth_experiments").insert({ user_id: userId, workspace_id: workspace.id, name, hypothesis, metric, baseline: Number.isFinite(baseline) ? baseline : null, target: Number.isFinite(target) ? target : null });
  if (error) throw new Error(error.message);
  revalidatePath("/growth");
}
