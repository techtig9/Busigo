"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/**
 * Signs out every session for this account except the one making the request —
 * the practical "revoke other sessions" control. Supabase Auth doesn't expose a
 * simple per-session list/selective-revoke API to the client SDK today (that
 * needs the Admin API's session endpoints against a service-role key); this
 * covers the common "I think someone else has my password" case without it.
 */
export async function revokeOtherSessionsAction(): Promise<ActionResult> {
  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: error.message };
  return { success: true };
}

/** Signs out every session for this account, including the current one. */
export async function revokeAllSessionsAction() {
  const supabase = createServerSupabase();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
