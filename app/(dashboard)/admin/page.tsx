import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { SubscriptionOverrideRow } from "./SubscriptionOverrideRow";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  // Service-role client — the admin panel deliberately reads across every workspace/user,
  // which RLS would otherwise block.
  const admin = createServiceRoleSupabase();
  const [{ data: workspaces }, { data: subs }, { data: memberCounts }, { data: users }, { data: payments }] = await Promise.all([
    admin.from("workspaces").select("id, name, is_personal, owner_id, created_at").order("created_at", { ascending: false }),
    // Billing is workspace-centric as of Phase 3 — subscriptions.workspace_id is the real,
    // unique billing unit; subscriptions.user_id is just the billing contact and can repeat
    // across a person's own personal workspace and any team workspace they created.
    admin.from("subscriptions").select("id, workspace_id, plan, status, credits_remaining, renews_at"),
    admin.from("workspace_members").select("workspace_id"),
    admin.from("users").select("id, name, email, role, created_at").order("created_at", { ascending: false }),
    admin.from("payments").select("id, workspace_id, amount, status, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  const subsByWorkspace = new Map((subs || []).map((s) => [s.workspace_id, s]));
  const ownersById = new Map((users || []).map((u) => [u.id, u]));
  const memberCountByWorkspace = new Map<string, number>();
  for (const m of memberCounts || []) {
    memberCountByWorkspace.set(m.workspace_id, (memberCountByWorkspace.get(m.workspace_id) ?? 0) + 1);
  }
  const workspacesById = new Map((workspaces || []).map((w) => [w.id, w]));

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" />

      <Card>
        <h2 className="mb-3 font-bold text-ink">Workspaces & subscriptions</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="py-2">Workspace</th>
              <th className="py-2">Owner</th>
              <th className="py-2">Members</th>
              <th className="py-2">Plan / Status</th>
              <th className="py-2">Credits</th>
              <th className="py-2">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {(workspaces || []).map((w) => {
              const sub = subsByWorkspace.get(w.id);
              const owner = ownersById.get(w.owner_id);
              return (
                <tr key={w.id}>
                  <td className="py-2">
                    {w.name} {w.is_personal && <Badge tone="slate">personal</Badge>}
                  </td>
                  <td className="py-2 text-slate">{owner?.email || w.owner_id}</td>
                  <td className="py-2">{memberCountByWorkspace.get(w.id) ?? 0}</td>
                  <td className="py-2 capitalize">{sub ? `${sub.plan} / ${sub.status}` : "—"}</td>
                  <td className="py-2">{sub?.credits_remaining ?? "—"}</td>
                  <td className="py-2">
                    <SubscriptionOverrideRow workspaceId={w.id} currentPlan={sub?.plan || "free"} currentStatus={sub?.status || "active"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-3 font-bold text-ink">Users</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
              <th className="py-2">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {(users || []).map((u) => (
              <tr key={u.id}>
                <td className="py-2">{u.name || "—"}</td>
                <td className="py-2 text-slate">{u.email}</td>
                <td className="py-2 capitalize">{u.role}</td>
                <td className="py-2 text-slate">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-3 font-bold text-ink">Recent payments</h2>
        {!payments || payments.length === 0 ? (
          <p className="text-sm text-slate">No payments yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="py-2">Workspace</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2">{workspacesById.get(p.workspace_id)?.name || p.workspace_id}</td>
                  <td className="py-2">${Number(p.amount || 0).toFixed(2)}</td>
                  <td className="py-2 capitalize">{p.status}</td>
                  <td className="py-2 text-slate">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
