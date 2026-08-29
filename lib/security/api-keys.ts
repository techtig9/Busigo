// Pure generation/hashing helpers — no "server-only" or Supabase import, so these
// stay directly unit-testable (test/api-keys.test.ts). The DB-touching verifier
// that looks a key up against workspace_api_keys lives in
// lib/security/api-key-verify.ts for the same reason described in
// lib/security/webhook-signing.ts.
import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "bg_live_";

export function generateApiKey(): { key: string; prefix: string } {
  const key = KEY_PREFIX + randomBytes(24).toString("hex");
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 8) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export { KEY_PREFIX };
