"use server";

import { requireWorkspace } from "@/lib/workspace/authorize";
import { revalidatePath } from "next/cache";

export async function requestIntegrationAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const provider = String(formData.get("provider") || "").trim();
  const displayName = String(formData.get("display_name") || provider).trim();
  const authType = String(formData.get("auth_type") || "oauth").trim();
  const scopes = String(formData.get("scopes") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const capabilities = String(formData.get("capabilities") || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!provider) throw new Error("Provider is required");

  const { error } = await supabase.from("integration_accounts").upsert({
    user_id: userId,
    workspace_id: workspace.id,
    provider,
    display_name: displayName,
    auth_type: authType,
    scopes,
    capabilities,
    permissions: scopes,
    status: "requested",
    metadata: { phase: 2, setup: "provider_connection_required" },
    updated_at: new Date().toISOString(),
  }, { onConflict: "workspace_id,provider" });
  if (error) throw new Error(error.message);
  revalidatePath("/connect");
  revalidatePath("/connections");
}

export async function createDataSourceAction(formData: FormData) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const type = String(formData.get("source_type") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const url = String(formData.get("url") || "").trim() || null;
  if (!type || !name) throw new Error("Source type and name are required");
  if (type === "website" && !url) throw new Error("Website URL is required");

  const { data: source, error } = await supabase.from("business_data_sources").insert({
    user_id: userId,
    workspace_id: workspace.id,
    source_type: type,
    name,
    url,
    status: type === "website" ? "pending" : "ready",
    metadata: { ingestion_mode: "phase2", indexed: false },
  }).select("id").single();
  if (error) throw new Error(error.message);

  if (type === "website" && source?.id) {
    const { error: analysisError } = await supabase.from("website_analyses").insert({
      user_id: userId,
      workspace_id: workspace.id,
      source_id: source.id,
      url,
      status: "queued",
    });
    if (analysisError) throw new Error(analysisError.message);
  }
  revalidatePath("/connect");
  revalidatePath("/business-brain");
}

export async function queueSyncAction(integrationId: string) {
  const { supabase, workspace, userId } = await requireWorkspace("member");
  const { data: integration, error: readError } = await supabase.from("integration_accounts").select("id").eq("id", integrationId).eq("workspace_id", workspace.id).single();
  if (readError || !integration) throw new Error("Integration not found");
  const { error } = await supabase.from("integration_sync_runs").insert({ user_id: userId, workspace_id: workspace.id, integration_id: integrationId, status: "queued" });
  if (error) throw new Error(error.message);
  await supabase.from("integration_accounts").update({ status: "syncing", updated_at: new Date().toISOString() }).eq("id", integrationId).eq("workspace_id", workspace.id);
  revalidatePath("/connect");
}
