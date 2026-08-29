"use server";

import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { PLAN_CREDITS } from "@/lib/plans";
import type { Plan } from "@/types/database";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Admin access required.");
  return user;
}

// Overrides by workspace_id, not user_id — subscriptions.user_id is just the billing
// contact who happened to create the workspace (Phase 3) and is NOT unique: the same person
// can be the billing-contact user_id on both their own personal workspace's subscription
// and any team workspace they created, so a user_id-based update could silently apply to
// more than one workspace's plan at once. workspace_id is the actual, unique billing unit.
export async function overrideSubscriptionAction(targetWorkspaceId: string, plan: Plan, status: string) {
  await requireAdmin();
  const admin = createServiceRoleSupabase();
  const { error } = await admin
    .from("subscriptions")
    .update({ plan, status, credits_remaining: PLAN_CREDITS[plan] })
    .eq("workspace_id", targetWorkspaceId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
