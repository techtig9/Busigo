"use server";

import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { PLAN_CREDITS } from "@/lib/plans";
import { checkRateLimit } from "@/lib/platform/rate-limit";

export interface ActionResult {
  error?: string;
}

/** Best-effort caller IP from the standard proxy header — not authenticated or spoof-proof,
 * good enough for a rate-limit dimension, not for anything security-critical on its own. */
function clientIp(): string {
  return headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  if (!name || !email || !password) return { error: "All fields are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  // Signup spam / mass fake-account creation — limited per IP rather than per email, since a
  // spammer supplies a different email on every attempt.
  const rate = await checkRateLimit(clientIp(), "signup", 5, 60 * 60);
  if (!rate.allowed) return { error: "Too many accounts created from this network recently. Please try again later." };

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Sign up failed — please try again." };

  // Mirror the auth user into public.users, create their personal workspace, then a Free
  // subscription scoped to that workspace (subscriptions.workspace_id is NOT NULL — the
  // workspace must exist first). Uses the service-role client because RLS on these tables
  // restricts writes to the row owner/an existing member, and at this instant the session
  // cookie may not be set yet, nor is the user a workspace_member yet for the first insert.
  const admin = createServiceRoleSupabase();
  await admin.from("users").insert({ id: data.user.id, name, email, role: "user" });

  // Every account gets a personal workspace — mirrors the one-time backfill in
  // supabase/migrations/20260822090000_phase18_workspace_foundation.sql for pre-existing
  // accounts. Slug pattern matches that migration's convention.
  const { data: workspace } = await admin
    .from("workspaces")
    .insert({
      name: `${name || email.split("@")[0]}'s Workspace`,
      slug: `ws-${data.user.id.replace(/-/g, "")}`,
      owner_id: data.user.id,
      is_personal: true,
    })
    .select("id")
    .single();

  if (workspace) {
    await admin.from("workspace_members").insert({ workspace_id: workspace.id, user_id: data.user.id, role: "owner" });
    await admin.from("subscriptions").insert({
      user_id: data.user.id,
      workspace_id: workspace.id,
      plan: "free",
      status: "active",
      credits_remaining: PLAN_CREDITS.free,
    });
  }

  // Deliberately does NOT call redirect() here: the caller (SignupForm) awaits this inside a
  // try/catch, and redirect()'s internal NEXT_REDIRECT signal would be caught there as a
  // normal error instead of triggering navigation. The client navigates on success instead.
  return {};
}

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  // Brute-force protection, scoped to the specific account being targeted rather than the
  // caller's IP — a distributed attacker rotating IPs against one email is the realistic
  // threat here, not one IP trying many emails (that's signup spam, limited separately above).
  const rate = await checkRateLimit(email.toLowerCase(), "login_attempt", 10, 5 * 60);
  if (!rate.allowed) return { error: "Too many sign-in attempts for this account. Please wait a few minutes and try again." };

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // See the comment in signUpAction — no redirect() here; the client navigates on success.
  return {};
}

export async function signInWithGoogleAction() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/auth/callback` },
  });
  if (error || !data.url) return;
  redirect(data.url);
}

export async function signOutAction() {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "");

  // Prevents email-bombing a target account with reset emails.
  const rate = await checkRateLimit(email.toLowerCase(), "password_reset", 3, 15 * 60);
  if (!rate.allowed) return { error: "Too many reset requests for this account. Please wait a few minutes and try again." };

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/reset-password`,
  });
  if (error) return { error: error.message };
  return {};
}

export async function updatePasswordAction(formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // See the comment in signUpAction — no redirect() here; the client navigates on success.
  return {};
}
