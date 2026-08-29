"use server";

import { requireWorkspace, writeAuditLog } from "@/lib/workspace/authorize";
import { canUseFeature, PLAN_LIMITS } from "@/lib/plans";
import type { StepDefinition, TriggerType, Plan } from "@/types/database";
import { nextRunAfter } from "@/lib/engine/cron";
import { normalizeToGraph, validateGraph, type WorkflowDefinition } from "@/lib/engine/graph";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Converted to workspace scoping (Master Spec section 2) as the reference implementation:
// every filter that used to be .eq("user_id", user.id) is now .eq("workspace_id", workspace.id),
// row-owning inserts set both user_id (still NOT NULL -- records who acted) and workspace_id
// (who it belongs to), and every mutation now checks workspace membership via
// requireWorkspace() before touching the database -- with Postgres RLS enforcing the
// identical rule independently underneath. Plan/credit gating (canUseFeature) is
// workspace-centric as of Phase 3 (Master Spec section 8) — the workspace's shared plan
// and credit pool, not the acting user's own personal subscription.

export async function createWorkflowAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const triggerType = String(formData.get("trigger_type") || "webhook") as TriggerType;
  const templateId = String(formData.get("template_id") || "");

  if (!name) throw new Error("Workflow name is required.");

  const { count } = await supabase
    .from("workflows")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  const gate = await canUseFeature({ workspaceId: workspace.id, actingUserId: userId, check: { action: "publish_workflow", currentWorkflowCount: count ?? 0 } });
  if (!gate.allowed) throw new Error(gate.reason);

  // A template's definition may be either format (see lib/engine/graph.ts) — stored and
  // copied verbatim either way; the executor and canvas both normalize on read.
  let definition: WorkflowDefinition = [];
  if (templateId) {
    const { data: template } = await supabase.from("templates").select("definition").eq("id", templateId).single();
    if (template) definition = template.definition as WorkflowDefinition;
  }

  const { data: workflow, error } = await supabase
    .from("workflows")
    .insert({ user_id: userId, workspace_id: workspace.id, name, description, trigger_type: triggerType, definition, status: "draft" })
    .select("id")
    .single();

  if (error || !workflow) throw new Error(error?.message || "Could not create workflow.");

  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "workflow.created", targetType: "workflow", targetId: workflow.id, metadata: { name } });
  return workflow.id as string;
}

export async function saveDefinitionAction(workflowId: string, definition: WorkflowDefinition) {
  const { supabase, workspace, userId } = await requireWorkspace("member");

  const graph = normalizeToGraph(definition);
  const validation = validateGraph(graph);
  if (!validation.valid) throw new Error(validation.errors[0]);

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("workspace_id", workspace.id).single();
  const { data: profile } = await supabase.from("users").select("role").eq("id", userId).single();
  const limits = PLAN_LIMITS[(sub?.plan as Plan) || "free"];

  if (profile?.role !== "admin") {
    if (graph.nodes.length > limits.maxStepsPerWorkflow) {
      throw new Error(`Your plan allows up to ${limits.maxStepsPerWorkflow} steps per workflow.`);
    }
    if (!limits.aiActionStep && graph.nodes.some((n) => n.type === "ai_action")) {
      throw new Error("AI Action steps require the Starter plan or higher.");
    }
  }

  const { error } = await supabase
    .from("workflows")
    .update({ definition })
    .eq("id", workflowId)
    .eq("workspace_id", workspace.id);

  if (error) throw new Error(error.message);
  revalidatePath(`/workflows/${workflowId}`);
}

export async function saveVersionAction(workflowId: string) {
  const { supabase, workspace, userId } = await requireWorkspace("member");

  const gate = await canUseFeature({ workspaceId: workspace.id, actingUserId: userId, check: { action: "use_version_history" } });
  if (!gate.allowed) throw new Error(gate.reason);

  const { data: workflow } = await supabase
    .from("workflows")
    .select("definition")
    .eq("id", workflowId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!workflow) throw new Error("Workflow not found.");

  const { error } = await supabase
    .from("workflow_versions")
    .insert({ workflow_id: workflowId, workspace_id: workspace.id, definition: workflow.definition });
  if (error) throw new Error(error.message);

  revalidatePath(`/workflows/${workflowId}`);
}

export async function rollbackToVersionAction(workflowId: string, versionId: string) {
  const { supabase, workspace, userId } = await requireWorkspace("member");

  const { data: version } = await supabase
    .from("workflow_versions")
    .select("definition, workflow_id")
    .eq("id", versionId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!version || version.workflow_id !== workflowId) throw new Error("Version not found.");

  const { error } = await supabase
    .from("workflows")
    .update({ definition: version.definition })
    .eq("id", workflowId)
    .eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);

  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "workflow.rolled_back", targetType: "workflow", targetId: workflowId, metadata: { versionId } });
  revalidatePath(`/workflows/${workflowId}`);
}

export async function publishWorkflowAction(workflowId: string) {
  const { supabase, workspace, userId } = await requireWorkspace("member");

  const { count } = await supabase
    .from("workflows")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .eq("status", "published")
    .neq("id", workflowId);

  const gate = await canUseFeature({ workspaceId: workspace.id, actingUserId: userId, check: { action: "publish_workflow", currentWorkflowCount: count ?? 0 } });
  if (!gate.allowed) throw new Error(gate.reason);

  const { data: workflow } = await supabase
    .from("workflows")
    .select("definition, trigger_type, trigger_config")
    .eq("id", workflowId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!workflow) throw new Error("Workflow not found.");
  const graphAtPublish = normalizeToGraph(workflow.definition);
  if (graphAtPublish.nodes.length === 0) {
    throw new Error("Add at least one step before publishing.");
  }
  const publishValidation = validateGraph(graphAtPublish);
  if (!publishValidation.valid) throw new Error(publishValidation.errors[0]);

  await supabase.from("workflow_versions").insert({ workflow_id: workflowId, workspace_id: workspace.id, definition: workflow.definition });

  const updates: Record<string, any> = { status: "published" };
  if (workflow.trigger_type === "schedule") {
    const cron = (workflow.trigger_config as any)?.cron;
    if (!cron) throw new Error("Set a cron expression before publishing a scheduled workflow.");
    const next = nextRunAfter(cron, new Date());
    if (!next) throw new Error("That cron expression couldn't be parsed. Use standard 5-field syntax, e.g. \"0 9 * * *\".");
    updates.next_run_at = next.toISOString();
  }

  const { error } = await supabase.from("workflows").update(updates).eq("id", workflowId).eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);

  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "workflow.published", targetType: "workflow", targetId: workflowId });
  revalidatePath(`/workflows/${workflowId}`);
  revalidatePath("/workflows");
}

export async function updateTriggerConfigAction(workflowId: string, triggerConfig: Record<string, any>) {
  const { supabase, workspace } = await requireWorkspace("member");
  const { error } = await supabase
    .from("workflows")
    .update({ trigger_config: triggerConfig })
    .eq("id", workflowId)
    .eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/workflows/${workflowId}`);
}

export async function unpublishWorkflowAction(workflowId: string) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const { error } = await supabase
    .from("workflows")
    .update({ status: "draft" })
    .eq("id", workflowId)
    .eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);
  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "workflow.unpublished", targetType: "workflow", targetId: workflowId });
  revalidatePath(`/workflows/${workflowId}`);
  revalidatePath("/workflows");
}

export async function duplicateWorkflowAction(workflowId: string) {
  const { supabase, workspace, userId } = await requireWorkspace("member");

  const { data: original } = await supabase
    .from("workflows")
    .select("name, description, trigger_type, trigger_config, definition")
    .eq("id", workflowId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!original) throw new Error("Workflow not found.");

  const { data: copy, error } = await supabase
    .from("workflows")
    .insert({
      user_id: userId,
      workspace_id: workspace.id,
      name: `${original.name} (copy)`,
      description: original.description,
      trigger_type: original.trigger_type,
      trigger_config: original.trigger_config,
      definition: original.definition,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !copy) throw new Error(error?.message || "Could not duplicate workflow.");

  revalidatePath("/workflows");
  return copy.id as string;
}

export async function regenerateWebhookTokenAction(workflowId: string) {
  const { supabase, workspace, userId } = await requireWorkspace("manager");
  const newToken = crypto.randomUUID();

  const { error } = await supabase
    .from("workflows")
    .update({ trigger_token: newToken })
    .eq("id", workflowId)
    .eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);

  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "workflow.webhook_token_regenerated", targetType: "workflow", targetId: workflowId });
  revalidatePath(`/workflows/${workflowId}`);
}

export async function deleteWorkflowAction(workflowId: string) {
  const { supabase, workspace, userId } = await requireWorkspace("manager");
  const { error } = await supabase.from("workflows").delete().eq("id", workflowId).eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);
  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "workflow.deleted", targetType: "workflow", targetId: workflowId });
  revalidatePath("/workflows");
  redirect("/workflows");
}

export async function saveFormFieldsAction(workflowId: string, slug: string, fields: any[]) {
  const { supabase, workspace } = await requireWorkspace("member");

  const { data: workflow } = await supabase
    .from("workflows")
    .select("id")
    .eq("id", workflowId)
    .eq("workspace_id", workspace.id)
    .single();
  if (!workflow) throw new Error("Workflow not found.");

  const { data: existing } = await supabase.from("forms").select("id").eq("workflow_id", workflowId).single();

  if (existing) {
    const { error } = await supabase.from("forms").update({ slug, fields }).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("forms").insert({ workflow_id: workflowId, workspace_id: workspace.id, slug, fields });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/workflows/${workflowId}`);
  revalidatePath("/forms");
}

export async function architectAndCreateWorkflowAction(request: string) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const { architectAutomation, validateAutomationPlan } = await import("@/lib/engine/automation-architect");
  const plan = architectAutomation(request);
  const validation = validateAutomationPlan(plan);
  if (!validation.valid) throw new Error(validation.errors.join(" "));

  const { data: workflow, error } = await supabase.from("workflows").insert({
    user_id: userId,
    workspace_id: workspace.id,
    name: plan.name,
    description: plan.description,
    trigger_type: plan.triggerType,
    trigger_config: plan.triggerConfig,
    definition: plan.steps,
    status: "draft",
  }).select("id").single();
  if (error || !workflow) throw new Error(error?.message || "Could not create automation.");

  await supabase.from("workflow_versions").insert({ workflow_id: workflow.id, workspace_id: workspace.id, definition: plan.steps });
  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "workflow.ai_generated", targetType: "workflow", targetId: workflow.id, metadata: { request } });
  return { workflowId: workflow.id as string, plan };
}

export async function simulateAutomationAction(definition: StepDefinition[], triggerPayload: Record<string, any> = {}) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const simulatedSteps = definition.map((s, index) => ({
    index: index + 1,
    key: s.key,
    type: s.type,
    status: "simulated",
    sideEffect: ["send_email", "http_request"].includes(s.type) ? "blocked" : "none",
    note: s.type === "send_email" ? "Email delivery blocked in simulation." : s.type === "http_request" ? "HTTP request blocked in simulation." : "No external side effect performed.",
  }));
  const result = { safe: true, mode: "simulation", triggerPayload, steps: simulatedSteps, externalSideEffects: 0 };
  const { error } = await supabase.from("automation_simulations").insert({ definition, trigger_payload: triggerPayload, result, user_id: userId, workspace_id: workspace.id });
  if (error) throw new Error(error.message);
  return result;
}
