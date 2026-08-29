"use server";

import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function updateNameAction(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name can't be empty." };

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createServiceRoleSupabase();
  const { error } = await admin.from("users").update({ name }).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: true };
}

export async function updateOwnPasswordAction(formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { success: true };
}
