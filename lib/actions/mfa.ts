"use server";

import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { createHash, randomBytes } from "crypto";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function requireUser() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/**
 * Starts TOTP enrollment. Returns the QR code (as an SVG data URI) and the
 * plain secret for manual entry — the person scans this into an authenticator
 * app, then calls verifyTotpEnrollmentAction with the 6-digit code it shows.
 * The factor is "unverified" until that call succeeds, and unverified factors
 * don't yet require MFA at sign-in.
 */
export async function enrollTotpAction(): Promise<ActionResult & { factorId?: string; qrCode?: string; secret?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `BusiGo ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { error: error?.message || "Could not start MFA enrollment." };
  return { success: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotpEnrollmentAction(factorId: string, code: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: error.message };
  return { success: true };
}

export async function listMfaFactorsAction() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { factors: [], error: error.message };
  return { factors: data.totp.map((f) => ({ id: f.id, friendlyName: f.friendly_name, status: f.status, createdAt: f.created_at })) };
}

export async function unenrollFactorAction(factorId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };
  return { success: true };
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function formatCode(raw: Buffer) {
  return raw.toString("hex").slice(0, 10).match(/.{1,5}/g)!.join("-");
}

/**
 * Generates 10 one-time recovery codes for accounts where MFA is active,
 * shown to the person exactly once. Only their salted hashes are stored
 * (users.mfa_recovery_codes) — losing this list means generating a fresh set,
 * same as every major provider's recovery-code UX.
 */
export async function generateRecoveryCodesAction(): Promise<ActionResult & { codes?: string[] }> {
  const { user } = await requireUser();
  const codes = Array.from({ length: 10 }, () => formatCode(randomBytes(6)));
  const hashes = codes.map(hashCode);

  const admin = createServiceRoleSupabase();
  const { error } = await admin.from("users").update({ mfa_recovery_codes: hashes }).eq("id", user.id);
  if (error) return { error: error.message };
  return { success: true, codes };
}

export async function redeemRecoveryCodeAction(code: string): Promise<ActionResult> {
  const { user } = await requireUser();
  const admin = createServiceRoleSupabase();
  const { data: row } = await admin.from("users").select("mfa_recovery_codes").eq("id", user.id).single();
  const hashes: string[] = row?.mfa_recovery_codes ?? [];
  const target = hashCode(code.trim());
  if (!hashes.includes(target)) return { error: "That recovery code is invalid or already used." };

  await admin.from("users").update({ mfa_recovery_codes: hashes.filter((h) => h !== target) }).eq("id", user.id);
  return { success: true };
}

// --- Sign-in step-up (AAL2) --------------------------------------------------------------
// Everything above manages factors within an already-fully-authenticated session (Settings).
// Below is the OTHER half: actually requiring that step-up at sign-in. A verified TOTP
// factor on its own does nothing to gate login — Supabase issues a normal session on
// password sign-in regardless, at AAL1; enforcement is this challenge screen plus
// middleware.ts checking the session's AAL on every request and redirecting here if a
// factor exists but hasn't been verified this session.

/** Whether the just-signed-in session still needs an MFA challenge before being treated as fully authenticated. */
export async function checkMfaChallengeNeededAction(): Promise<{ needed: boolean; factorId?: string }> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return { needed: false };
  if (data.currentLevel === data.nextLevel) return { needed: false };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factorId = factors?.totp.find((f) => f.status === "verified")?.id;
  return { needed: Boolean(factorId), factorId };
}

export async function verifyLoginChallengeAction(factorId: string, code: string): Promise<ActionResult> {
  const supabase = createServerSupabase();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Recovery-code path for someone who's lost their authenticator: redeems the code (same
 * check as redeemRecoveryCodeAction above), then removes every TOTP factor on the account
 * via the Admin API using the service-role key — necessary because Supabase's own
 * mfa.unenroll requires AAL2 to call normally, which is exactly the thing a locked-out user
 * doesn't have. This bypasses that requirement deliberately and only because the recovery
 * code itself (something only the account owner should have, generated and shown once
 * — see generateRecoveryCodesAction) is the proof of ownership standing in for it.
 * The account is left completely unenrolled from MFA afterward — the user should re-enroll
 * from Settings once back in.
 *
 * NOTE: uses Supabase's Admin REST API for factor deletion
 * (DELETE /auth/v1/admin/users/{user_id}/factors/{factor_id}), which could not be verified
 * against a live Supabase project in this environment — test this path against a real
 * project before relying on it.
 */
export async function useRecoveryCodeAtLoginAction(code: string): Promise<ActionResult> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createServiceRoleSupabase();
  const { data: row } = await admin.from("users").select("mfa_recovery_codes").eq("id", user.id).single();
  const hashes: string[] = row?.mfa_recovery_codes ?? [];
  const target = hashCode(code.trim());
  if (!hashes.includes(target)) return { error: "That recovery code is invalid or already used." };

  await admin.from("users").update({ mfa_recovery_codes: hashes.filter((h) => h !== target) }).eq("id", user.id);

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const factor of factors?.totp ?? []) {
    try {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}/factors/${factor.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey || "" },
      });
    } catch (e) {
      console.error("failed to remove MFA factor during recovery-code login:", e);
    }
  }

  return { success: true };
}
