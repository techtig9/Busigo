import { createServerSupabase } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function BusinessIntelligencePage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();

  const [snapshot, events, anomalies, alerts, entities] = await Promise.all([
    supabase.from("business_intelligence_snapshots").select("*").eq("workspace_id", workspace.id).order("snapshot_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("business_events").select("id, source, event_type, occurred_at, processed").eq("workspace_id", workspace.id).order("occurred_at", { ascending: false }).limit(10),
    supabase.from("business_anomalies").select("id, metric, severity, direction, deviation_pct, status, explanation, detected_at").eq("workspace_id", workspace.id).in("status", ["open", "acknowledged"]).order("detected_at", { ascending: false }).limit(8),
    supabase.from("business_alerts").select("id, title, body, severity, action_url, created_at, acknowledged_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("business_entity_state").select("entity_type, entity_id, updated_at").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }).limit(8),
  ]);

  const s: any = snapshot.data;
  const score = Math.max(0, Math.min(100, Math.round(Number(s?.health_score ?? 0))));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm font-semibold text-signal">Business Digital Twin</p><PageHeader title="Real-Time Business Intelligence" /><p className="mt-1 text-sm text-slate">A live view of business health, events, anomalies and emerging signals.</p></div>
        <Link href="/dashboard" className="text-sm font-semibold text-signal hover:underline">Back to Command Center</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate">Business health</p><p className="mt-1 text-3xl font-bold text-ink">{score}/100</p><p className="mt-1 text-xs text-slate">Latest intelligence snapshot</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate">Events</p><p className="mt-1 text-3xl font-bold text-ink">{events.data?.length ?? 0}</p><p className="mt-1 text-xs text-slate">Recent business signals</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate">Open anomalies</p><p className="mt-1 text-3xl font-bold text-ink">{anomalies.data?.length ?? 0}</p><p className="mt-1 text-xs text-slate">Signals needing attention</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate">Tracked entities</p><p className="mt-1 text-3xl font-bold text-ink">{entities.data?.length ?? 0}</p><p className="mt-1 text-xs text-slate">Digital-twin state records</p></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between"><h2 className="font-bold text-ink">Health signals</h2><span className="text-xs text-slate">Latest snapshot</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[["Revenue",s?.revenue_signal],["Sales",s?.sales_signal],["Customers",s?.customer_signal],["Operations",s?.operations_signal],["Marketing",s?.marketing_signal],["Finance",s?.finance_signal]].map(([label,value]) => <div key={label as string} className="rounded bg-surface p-3"><p className="text-xs text-slate">{label as string}</p><p className="mt-1 font-bold text-ink">{value == null ? "—" : `${Math.round(Number(value))}/100`}</p></div>)}
          </div>
          {s?.summary && <p className="mt-4 text-sm text-slate">{s.summary}</p>}
        </Card>
        <Card>
          <div className="flex items-center justify-between"><h2 className="font-bold text-ink">Anomalies</h2><span className="text-xs text-slate">Needs attention</span></div>
          <div className="mt-3 space-y-2">{(anomalies.data ?? []).length === 0 ? <p className="text-sm text-slate">No open anomalies detected.</p> : anomalies.data?.map((a: any) => <div key={a.id} className="rounded border border-hairline p-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-ink">{a.metric}</p><Badge tone={statusTone(a.severity)}>{a.severity}</Badge></div><p className="mt-1 text-xs text-slate">{a.explanation || `${a.direction} signal${a.deviation_pct == null ? "" : ` · ${Number(a.deviation_pct).toFixed(1)}% deviation`}`}</p></div>)}</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="font-bold text-ink">Live business events</h2><div className="mt-3 divide-y divide-hairline">{(events.data ?? []).length === 0 ? <p className="py-3 text-sm text-slate">Connect a data source to begin collecting business events.</p> : events.data?.map((e: any) => <div key={e.id} className="flex items-center justify-between py-2.5"><div><p className="text-sm font-semibold text-ink">{e.event_type}</p><p className="text-xs text-slate">{e.source} · {new Date(e.occurred_at).toLocaleString()}</p></div><Badge tone={e.processed ? "success" : "warning"}>{e.processed ? "processed" : "new"}</Badge></div>)}</div></Card>
        <Card><h2 className="font-bold text-ink">Business alerts</h2><div className="mt-3 space-y-2">{(alerts.data ?? []).length === 0 ? <p className="text-sm text-slate">No active alerts.</p> : alerts.data?.map((a: any) => <div key={a.id} className="rounded border border-hairline p-3"><div className="flex items-center justify-between"><p className="font-semibold text-ink">{a.title}</p><Badge tone={statusTone(a.severity)}>{a.severity}</Badge></div><p className="mt-1 text-sm text-slate">{a.body}</p>{a.action_url && <Link className="mt-2 inline-block text-xs font-semibold text-signal" href={a.action_url}>Open action →</Link>}</div>)}</div></Card>
      </div>
    </div>
  );
}
