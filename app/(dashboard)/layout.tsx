import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopNav } from "@/components/dashboard/TopNav";
import { Footer } from "@/components/Footer";
import { ChatWidget } from "@/components/assistant/ChatWidget";
import { getWorkspaceContext, listMyWorkspaces } from "@/lib/workspace/context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("name, role").eq("id", user.id).single();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, link, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15);

  const isAdmin = profile?.role === "admin";

  // Every account gets a personal workspace at signup (and every pre-existing account was
  // backfilled with one — see supabase/migrations/20260822090000_phase18_workspace_foundation.sql),
  // so this should always resolve. If it somehow doesn't, don't take down the whole
  // dashboard over it — the switcher just won't render, same as before this phase.
  let workspaceCtx: Awaited<ReturnType<typeof getWorkspaceContext>> | null = null;
  let workspaceList: Awaited<ReturnType<typeof listMyWorkspaces>> = [];
  try {
    [workspaceCtx, workspaceList] = await Promise.all([getWorkspaceContext(), listMyWorkspaces()]);
  } catch (e) {
    console.error("workspace context unavailable:", e);
  }

  // The plan badge reflects the current WORKSPACE's plan (billing is workspace-centric as of
  // Phase 3), not the signed-in user's own historical subscription row.
  const { data: sub } = workspaceCtx
    ? await supabase.from("subscriptions").select("plan").eq("workspace_id", workspaceCtx.workspace.id).single()
    : { data: null };

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopNav
          userName={profile?.name || user.email || "Account"}
          plan={sub?.plan || "free"}
          isAdmin={isAdmin}
          notifications={notifications || []}
          currentWorkspace={
            workspaceCtx ? { id: workspaceCtx.workspace.id, name: workspaceCtx.workspace.name, is_personal: workspaceCtx.workspace.is_personal, role: workspaceCtx.role } : undefined
          }
          workspaceOptions={workspaceList.map((w) => ({ id: w.workspace.id, name: w.workspace.name, is_personal: w.workspace.is_personal, role: w.role }))}
        />
        <main className="flex-1 bg-canvas p-6">{children}</main>
        <Footer />
      </div>
      {/* Assistant only ever mounts inside this auth-gated layout — it requires a signed-in
          user both here and, redundantly, inside its own API route. */}
      <ChatWidget />
    </div>
  );
}
