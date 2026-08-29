import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { PLAN_CREDITS } from "@/lib/plans";

// Handles both the email-verification link and the Google OAuth redirect — Supabase Auth
// sends the user here with a `code` param to exchange for a session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createServerSupabase();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // signUpAction bootstraps users/subscriptions/workspace rows for email/password
    // signups, but Google OAuth signups land here directly and previously got none of
    // that — meaning every Business OS feature (which requires a public.users row via
    // FK) and now workspaces would silently break for anyone who signed up with Google.
    // Bootstrap the same rows here, guarded so this is a no-op for returning users.
    if (data.user) {
      const admin = createServiceRoleSupabase();
      const { data: existing } = await admin.from("users").select("id").eq("id", data.user.id).maybeSingle();
      if (!existing) {
        const name = (data.user.user_metadata?.full_name || data.user.user_metadata?.name || "") as string;
        const email = data.user.email || "";
        await admin.from("users").insert({ id: data.user.id, name, email, role: "user" });

        const { data: workspace } = await admin
          .from("workspaces")
          .insert({
            name: `${name || email.split("@")[0] || "My"}'s Workspace`,
            slug: `ws-${data.user.id.replace(/-/g, "")}`,
            owner_id: data.user.id,
            is_personal: true,
          })
          .select("id")
          .single();
        if (workspace) {
          await admin.from("workspace_members").insert({ workspace_id: workspace.id, user_id: data.user.id, role: "owner" });
          // subscriptions.workspace_id is NOT NULL — must be created after the workspace, not
          // alongside users, or this insert fails outright (same bug class as everywhere else
          // fixed this phase: a NOT NULL column added in Phase 1 that nothing populated yet).
          await admin.from("subscriptions").insert({ user_id: data.user.id, workspace_id: workspace.id, plan: "free", status: "active", credits_remaining: PLAN_CREDITS.free });
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
