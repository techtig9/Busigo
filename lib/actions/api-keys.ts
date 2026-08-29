"use server";

import { requireWorkspace, writeAuditLog } from "@/lib/workspace/authorize";
import { hashApiKey, generateApiKey } from "@/lib/security/api-keys";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function listApiKeysAction() {
  const { supabase, workspace } = await requireWorkspace("security_admin");
  const { data } = await supabase
    .from("workspace_api_keys")
    .select("id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Creates a new key and returns the plaintext value exactly once — it is never stored or retrievable again. */
export async function createApiKeyAction(formData: FormData): Promise<ActionResult & { plaintextKey?: string }> {
  const { supabase, workspace, userId } = await requireWorkspace("security_admin");
  const name = String(formData.get("name") || "").trim();
  const scopesRaw = String(formData.get("scopes") || "");
  const scopes = scopesRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!name) return { error: "Name your key so you can recognize it later." };

  const { key, prefix } = generateApiKey();
  const { error } = await supabase.from("workspace_api_keys").insert({
    workspace_id: workspace.id,
    name,
    key_prefix: prefix,
    key_hash: hashApiKey(key),
    scopes,
    created_by: userId,
  });
  if (error) return { error: error.message };

  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "api_key.created", targetType: "workspace_api_key", metadata: { name, prefix, scopes } });
  revalidatePath("/settings");
  return { success: true, plaintextKey: key };
}

export async function revokeApiKeyAction(keyId: string): Promise<ActionResult> {
  const { supabase, workspace, userId } = await requireWorkspace("security_admin");
  const { error } = await supabase
    .from("workspace_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };

  await writeAuditLog({ workspaceId: workspace.id, actorId: userId, action: "api_key.revoked", targetType: "workspace_api_key", targetId: keyId });
  revalidatePath("/settings");
  return { success: true };
}
