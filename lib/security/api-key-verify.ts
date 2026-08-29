import "server-only";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { hashApiKey, KEY_PREFIX } from "./api-keys";

export interface ApiKeyAuth {
  workspaceId: string;
  keyId: string;
  scopes: string[];
}

/**
 * Verifies an `Authorization: Bearer bg_live_...` header against
 * workspace_api_keys and updates last_used_at. Returns null for anything
 * invalid, revoked, or expired — callers should respond 401 without
 * distinguishing which, so as not to help an attacker enumerate valid prefixes.
 */
export async function verifyApiKey(headerValue: string | null): Promise<ApiKeyAuth | null> {
  if (!headerValue?.startsWith("Bearer ")) return null;
  const key = headerValue.slice("Bearer ".length).trim();
  if (!key.startsWith(KEY_PREFIX)) return null;

  const admin = createServiceRoleSupabase();
  const { data: row } = await admin
    .from("workspace_api_keys")
    .select("id, workspace_id, key_hash, scopes, expires_at, revoked_at")
    .eq("key_prefix", key.slice(0, KEY_PREFIX.length + 8))
    .maybeSingle();

  if (!row || row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  if (row.key_hash !== hashApiKey(key)) return null;

  await admin.from("workspace_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  return { workspaceId: row.workspace_id, keyId: row.id, scopes: row.scopes ?? [] };
}
