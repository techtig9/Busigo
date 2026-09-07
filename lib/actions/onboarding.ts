"use server";

import { requireWorkspace } from "@/lib/workspace/authorize";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const SETTINGS_KEY = "onboarding_dismissed";
const STEP_KEY = "onboarding_step";

/**
 * Any member (not just admin+) can dismiss the getting-started checklist for the whole
 * workspace — it's a low-stakes shared UI preference, not a real workspace setting, so this
 * writes via the service-role client rather than requiring the "admins can write settings"
 * RLS policy that governs workspace_settings generally.
 */
export async function dismissOnboardingAction(): Promise<void> {
  const { workspace } = await requireWorkspace("member");
  const admin = createServiceRoleSupabase();
  await admin.from("workspace_settings").upsert(
    { workspace_id: workspace.id, key: SETTINGS_KEY, value: true, updated_at: new Date().toISOString() },
    { onConflict: "workspace_id,key" }
  );
  revalidatePath("/dashboard");
}

/**
 * Remembers which onboarding step the person was last on, so closing the tab and coming back
 * resumes rather than restarting (spec §5: "save/resume").
 *
 * Only the cursor is stored. Whether a step is actually *complete* is always derived from
 * real state — does a business row exist, is an app connected, has a workflow been published —
 * never from a "user clicked next" flag, which would let the wizard claim progress that
 * doesn't exist.
 */
export async function setOnboardingStepAction(step: number): Promise<void> {
  const { workspace } = await requireWorkspace("member");
  const admin = createServiceRoleSupabase();
  await admin.from("workspace_settings").upsert(
    { workspace_id: workspace.id, key: STEP_KEY, value: step, updated_at: new Date().toISOString() },
    { onConflict: "workspace_id,key" }
  );
  revalidatePath("/onboarding");
}

export async function getOnboardingStep(): Promise<number> {
  const { workspace } = await requireWorkspace("member");
  const admin = createServiceRoleSupabase();
  const { data } = await admin
    .from("workspace_settings")
    .select("value")
    .eq("workspace_id", workspace.id)
    .eq("key", STEP_KEY)
    .maybeSingle();
  const raw = Number(data?.value);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

/** Marks onboarding finished and sends the person to the Command Center. */
export async function finishOnboardingAction(): Promise<void> {
  await dismissOnboardingAction();
  redirect("/dashboard");
}
