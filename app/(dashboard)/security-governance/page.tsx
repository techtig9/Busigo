import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createGovernancePolicyAction, requestDataAction } from "@/lib/actions/security-governance";

export default async function SecurityGovernancePage() {
  const s = createServerSupabase();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const [{ data: events }, { data: logs }, { data: policies }, { data: requests }, { data: reviews }] = await Promise.all([
    s.from("security_events").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(12),
    s.from("audit_logs").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(12),
    s.from("governance_policies").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(12),
    s.from("data_requests").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(8),
    s.from("access_reviews").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(8),
  ]);
  const critical = (events || []).filter((e: any) => e.severity === "critical" && !e.resolved).length;
  const openReviews = (reviews || []).filter((r: any) => r.status === "open").length;
  return <div className="mx-auto max-w-6xl space-y-6">
    <div><h1 className="text-2xl font-bold text-ink">Security, Compliance & Governance</h1><p className="mt-1 text-sm text-slate">Control AI permissions, audit sensitive actions and manage privacy requests from one place.</p></div>
    <div className="grid gap-4 sm:grid-cols-4"><Card><p className="text-xs uppercase text-slate">Critical events</p><p className="mt-2 text-3xl font-bold text-ink">{critical}</p></Card><Card><p className="text-xs uppercase text-slate">Policies</p><p className="mt-2 text-3xl font-bold text-ink">{policies?.length || 0}</p></Card><Card><p className="text-xs uppercase text-slate">Open reviews</p><p className="mt-2 text-3xl font-bold text-ink">{openReviews}</p></Card><Card><p className="text-xs uppercase text-slate">Audit records</p><p className="mt-2 text-3xl font-bold text-ink">{logs?.length || 0}</p></Card></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><div className="flex items-center justify-between"><h2 className="font-bold text-ink">Governance policy</h2><Badge tone="signal">Human controlled</Badge></div><form action={createGovernancePolicyAction} className="mt-4 space-y-3"><input name="name" required placeholder="e.g. High-risk AI actions" className="w-full rounded border border-hairline bg-panel px-3 py-2 text-sm"/><select name="policy_type" className="w-full rounded border border-hairline bg-panel px-3 py-2 text-sm"><option>agent_actions</option><option>data_access</option><option>financial_actions</option><option>autonomous_operations</option></select><label className="flex items-center gap-2 text-sm text-slate"><input type="checkbox" name="require_approval" defaultChecked /> Require human approval</label><button className="rounded bg-signal px-4 py-2 text-sm font-semibold text-white">Create policy</button></form></Card>
      <Card><h2 className="font-bold text-ink">Privacy & access requests</h2><p className="mt-1 text-sm text-slate">Requests are recorded for controlled processing; destructive deletion is never performed implicitly.</p><div className="mt-4 flex flex-wrap gap-2"><form action={requestDataAction}><input type="hidden" name="request_type" value="export"/><button className="rounded border border-hairline px-3 py-2 text-sm font-semibold">Request data export</button></form><form action={requestDataAction}><input type="hidden" name="request_type" value="access_review"/><button className="rounded border border-hairline px-3 py-2 text-sm font-semibold">Request access review</button></form><form action={requestDataAction}><input type="hidden" name="request_type" value="delete"/><button className="rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Request account deletion</button></form></div></Card>
    </div>
    <div className="grid gap-6 lg:grid-cols-2"><Card><h2 className="font-bold text-ink">Security events</h2>{events?.length ? <div className="mt-3 space-y-2">{events.map((e:any)=><div key={e.id} className="rounded border border-hairline p-3"><div className="flex justify-between"><span className="font-semibold text-ink">{e.event_type}</span><Badge tone={e.severity === "critical" ? "danger" : e.severity === "warning" ? "signal" : "neutral"}>{e.severity}</Badge></div><p className="mt-1 text-xs text-slate">{new Date(e.created_at).toLocaleString()}</p></div>)}</div> : <p className="mt-3 text-sm text-slate">No security events recorded.</p>}</Card><Card><h2 className="font-bold text-ink">Audit trail</h2>{logs?.length ? <div className="mt-3 space-y-2">{logs.map((l:any)=><div key={l.id} className="rounded border border-hairline p-3"><div className="flex justify-between"><span className="text-sm font-semibold text-ink">{l.action}</span><Badge tone={l.outcome === "success" ? "signal" : "neutral"}>{l.outcome}</Badge></div><p className="mt-1 text-xs text-slate">{new Date(l.created_at).toLocaleString()}</p></div>)}</div> : <p className="mt-3 text-sm text-slate">No audit events recorded.</p>}</Card></div>
    <Card><h2 className="font-bold text-ink">Data requests</h2>{requests?.length ? <div className="mt-3 space-y-2">{requests.map((r:any)=><div key={r.id} className="flex items-center justify-between rounded border border-hairline p-3"><span className="text-sm text-ink">{r.request_type}</span><Badge tone="neutral">{r.status}</Badge></div>)}</div> : <p className="mt-3 text-sm text-slate">No privacy requests yet.</p>}</Card>
  </div>;
}
