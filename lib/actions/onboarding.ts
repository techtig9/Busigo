"use server";

import { requireWorkspace } from "@/lib/workspace/authorize";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const SETTINGS_KEY = "onboarding_dismissed";

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
