// Deliberately has NO "server-only" or Supabase import: these are pure functions
// (HMAC over strings, no I/O), directly unit-tested in test/webhook-signing.test.ts.
// DB-touching delivery logging lives separately in lib/security/webhook-delivery-log.ts
// — importing "server-only" there would make this file's pure functions untestable
// under the plain Node test runner this project uses (tsx --test has no webpack alias
// for the "server-only" bare specifier that Next.js's own build provides).
import { createHmac, timingSafeEqual } from "crypto";

const REPLAY_WINDOW_SECONDS = 5 * 60;

/**
 * Signs `${timestamp}.${payload}` with HMAC-SHA256, in the same shape Stripe/
 * GitHub/Paddle use — binding the timestamp into the signature (not sending it
 * as a bare separate header) is what makes the replay check below meaningful;
 * an attacker can't just re-send an old payload with today's timestamp because
 * they don't have the secret to produce a matching signature for that pair.
 */
export function signWebhookPayload(secret: string, payload: string, timestamp: number = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return { signature, timestamp, header: `t=${timestamp},v1=${signature}` };
}

export interface VerifyResult {
  valid: boolean;
  reason?: "malformed_header" | "bad_signature" | "expired";
}

/** Verifies a `t=...,v1=...` signature header and rejects anything outside the replay window. */
export function verifyWebhookSignature(secret: string, payload: string, header: string | null): VerifyResult {
  if (!header) return { valid: false, reason: "malformed_header" };
  const match = header.match(/^t=(\d+),v1=([0-9a-f]+)$/);
  if (!match) return { valid: false, reason: "malformed_header" };

  const timestamp = Number(match[1]);
  const providedSig = match[2];
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > REPLAY_WINDOW_SECONDS) return { valid: false, reason: "expired" };

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const a = Buffer.from(providedSig, "hex");
  const b = Buffer.from(expected, "hex");
  const valid = a.length === b.length && timingSafeEqual(a, b);
  return valid ? { valid: true } : { valid: false, reason: "bad_signature" };
}
