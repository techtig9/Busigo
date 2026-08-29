"use server";

import { requireWorkspace } from "@/lib/workspace/authorize";
import { revalidatePath } from "next/cache";

// Notifications stay per-user, not workspace-shared, on purpose: "your workflow failed"
// shouldn't blast every teammate, only whoever it's actually addressed to. requireWorkspace
// here is just the auth/session check (confirms the caller is a real signed-in member of
// some workspace); the notifications themselves are still scoped by the caller's own user_id.
export async function markNotificationReadAction(id: string) {
  const { supabase, userId } = await requireWorkspace("viewer");
  await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", userId);
  revalidatePath("/dashboard");
}

export async function markAllNotificationsReadAction() {
  const { supabase, userId } = await requireWorkspace("viewer");
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  revalidatePath("/dashboard");
}
