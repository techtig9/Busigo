import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { BusinessPhaseBar } from "@/components/dashboard/BusinessPhaseBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { createAutonomyPolicyAction, toggleAutonomyPolicyAction, createDecisionAction, resolveIncidentAction, markAlertReadAction, verifyDecisionAction } from "@/lib/actions/autonomous-ops";

export default async function AutonomousOpsPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const [{ data: policies }, { data: decisions }, { data: incidents }, { data: alerts }, { data: briefings }] = await Promise.all([
    supabase.from("autonomy_policies").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
    supabase.from("autonomous_decisions").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("automation_incidents").select("*").eq("workspace_id", workspace.id).neq("status", "resolved").order("created_at", { ascending: false }).limit(8),
    supabase.from("business_alerts").select("*").eq("workspace_id", workspace.id).eq("read", false).order("created_at", { ascending: false }).limit(8),
    supabase.from("executive_briefings").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(2),
  ]);
  const activePolicy = (policies || []).filter((p: any) => p.enabled).length;
  return <div className="mx-auto max-w-6xl space-y-6">
    <div><h1 className="text-2xl font-bold text-ink">Autonomous Business Operations</h1><p className="mt-1 text-sm text-slate">Phase 6 — continuous monitoring, controlled decisions, verification, incident response and executive intelligence.</p></div>
    <BusinessPhaseBar current={6}/>
    <div className="grid gap-4 md:grid-cols-4">
      <Card><p className="text-xs uppercase text-slate">Active policies</p><p className="mt-1 text-2xl font-bold text-ink">{activePolicy}</p></Card>
      <Card><p className="text-xs uppercase text-slate">Pending decisions</p><p className="mt-1 text-2xl font-bold text-ink">{(decisions || []).filter((d: any) => d.status === "recommended").length}</p></Card>
      <Card><p className="text-xs uppercase text-slate">Open incidents</p><p className="mt-1 text-2xl font-bold text-ink">{(incidents || []).length}</p></Card>
      <Card><p className="text-xs uppercase text-slate">Unread alerts</p><p className="mt-1 text-2xl font-bold text-ink">{(alerts || []).length}</p></Card>
    </div>
    <Card className="border-signal/30 bg-signal/5"><h2 className="font-bold text-ink">Autonomy safety contract</h2><p className="mt-2 text-sm text-slate">BusiGo never silently moves money, deletes business data, changes legal commitments, or publishes high-impact actions. Low-risk autonomy is opt-in and policy-scoped; higher-risk actions remain approval-gated.</p></Card>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><div className="flex items-center justify-between"><h2 className="font-bold text-ink">Policies</h2><Badge tone={activePolicy ? "pulse" : "warn"}>{activePolicy ? "controlled" : "off"}</Badge></div><form action={createAutonomyPolicyAction} className="mt-4 grid gap-2"><input name="name" defaultValue="Business Safe Mode" className="rounded border p-2 text-sm"/><select name="max_risk" className="rounded border p-2 text-sm"><option value="low">Low risk only</option><option value="medium">Low + medium</option></select><Button type="submit">Create / update policy</Button></form><div className="mt-4 space-y-2">{(policies || []).map((p: any) => <div key={p.id} className="flex items-center justify-between rounded border p-3"><div><p className="font-semibold text-ink">{p.name}</p><p className="text-xs text-slate">Max risk: {p.max_risk} · Approval: {p.requires_approval ? "required" : "not required"}</p></div><form action={async () => { "use server"; await toggleAutonomyPolicyAction(p.id, !p.enabled); }}><Button type="submit" variant="secondary">{p.enabled ? "Disable" : "Enable"}</Button></form></div>)}</div></Card>
      <Card><h2 className="font-bold text-ink">Decision center</h2><form action={createDecisionAction} className="mt-4 grid gap-2"><input name="title" placeholder="Decision to review" className="rounded border p-2 text-sm"/><textarea name="rationale" placeholder="Why BusiGo recommends it" className="rounded border p-2 text-sm"/><select name="risk_level" className="rounded border p-2 text-sm"><option>low</option><option>medium</option><option>high</option><option>critical</option></select><Button type="submit">Create recommendation</Button></form><div className="mt-4 space-y-2">{(decisions || []).map((d: any) => <div key={d.id} className="rounded border p-3"><div className="flex justify-between gap-3"><p className="font-semibold text-ink">{d.title}</p><Badge tone={d.risk_level === "low" ? "pulse" : "warn"}>{d.risk_level}</Badge></div><p className="mt-1 text-sm text-slate">{d.rationale}</p><div className="mt-2 flex gap-2"><form action={async () => { "use server"; await verifyDecisionAction(d.id, true); }}><Button type="submit" variant="secondary">Verify</Button></form><form action={async () => { "use server"; await verifyDecisionAction(d.id, false); }}><Button type="submit" variant="ghost">Reject</Button></form></div></div>)}</div></Card>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><h2 className="font-bold text-ink">Incidents & self-healing queue</h2><p className="mt-1 text-sm text-slate">Failures are isolated and surfaced for remediation instead of being retried blindly.</p><div className="mt-4 space-y-2">{(incidents || []).length ? incidents!.map((i: any) => <div key={i.id} className="rounded border p-3"><div className="flex justify-between"><p className="font-semibold text-ink">{i.title}</p><Badge tone="warn">{i.severity}</Badge></div><p className="mt-1 text-sm text-slate">{i.description}</p><form className="mt-2" action={async () => { "use server"; await resolveIncidentAction(i.id); }}><Button type="submit" variant="secondary">Resolve</Button></form></div>) : <p className="text-sm text-slate">No open incidents.</p>}</div></Card>
      <Card><h2 className="font-bold text-ink">Alerts</h2><div className="mt-4 space-y-2">{(alerts || []).length ? alerts!.map((a: any) => <div key={a.id} className="rounded border p-3"><div className="flex justify-between"><p className="font-semibold text-ink">{a.title}</p><Badge tone={a.severity === "critical" ? "warn" : "pulse"}>{a.severity}</Badge></div><p className="mt-1 text-sm text-slate">{a.message}</p><form className="mt-2" action={async () => { "use server"; await markAlertReadAction(a.id); }}><Button type="submit" variant="ghost">Mark read</Button></form></div>) : <p className="text-sm text-slate">No unread alerts.</p>}</div></Card>
    </div>
    <Card><h2 className="font-bold text-ink">CEO briefing</h2>{briefings?.[0] ? <><p className="mt-2 text-lg font-semibold text-ink">{briefings[0].headline}</p><p className="mt-1 text-sm text-slate">{briefings[0].summary}</p></> : <p className="mt-2 text-sm text-slate">No generated briefing yet. The production scheduler can populate daily and weekly briefings from verified KPI, outcome, incident and decision data.</p>}</Card>
  </div>;
}
