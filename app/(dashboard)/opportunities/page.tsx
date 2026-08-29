import { getBusinessContext } from "@/lib/business-os";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { createServerSupabase } from "@/lib/supabase/server";
import { createOpportunityAction } from "@/lib/actions/business-os";
import { BusinessPhaseBar } from "@/components/dashboard/BusinessPhaseBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default async function OpportunitiesPage() {
  const supabase = createServerSupabase(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const { opportunities } = await getBusinessContext(workspace.id);
  return <div className="mx-auto max-w-6xl space-y-6">
    <div><h1 className="text-2xl font-bold text-ink">AI Opportunities</h1><p className="mt-1 text-sm text-slate">Phase 2–3 — identify the work with the highest business value and turn it into automation.</p></div>
    <BusinessPhaseBar current={3} />
    <Card><div className="flex items-center justify-between"><div><h2 className="font-bold text-ink">Opportunity scanner</h2><p className="text-sm text-slate">These opportunities are stored as business objects so future AI analysis can rank and improve them.</p></div><Badge tone="pulse">{opportunities.length} found</Badge></div>
      <form action={createOpportunityAction} className="mt-4 grid gap-3 md:grid-cols-4"><input name="title" placeholder="Opportunity title" className="rounded border border-hairline bg-panel px-3 py-2 text-sm text-ink" required/><input name="description" placeholder="What should improve?" className="rounded border border-hairline bg-panel px-3 py-2 text-sm text-ink md:col-span-2"/><select name="impact" className="rounded border border-hairline bg-panel px-3 py-2 text-sm text-ink"><option>critical</option><option>high</option><option>medium</option><option>low</option></select><select name="effort" className="rounded border border-hairline bg-panel px-3 py-2 text-sm text-ink"><option>low</option><option>medium</option><option>high</option></select><input type="number" name="priority_score" placeholder="Priority score 0–100" className="rounded border border-hairline bg-panel px-3 py-2 text-sm text-ink"/><div><Button type="submit">Add opportunity</Button></div></form>
    </Card>
    <div className="grid gap-4">{opportunities.length === 0 ? <Card><p className="text-sm text-slate">No opportunities yet. Run the business interview first, then add the highest-value opportunities.</p></Card> : opportunities.map((o: any) => <Card key={o.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-ink">{o.title}</h3><p className="mt-1 text-sm text-slate">{o.description || "No description yet."}</p></div><Badge tone={o.impact === "critical" || o.impact === "high" ? "pulse" : "slate"}>{o.impact} impact</Badge></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><div><span className="text-slate">Priority</span><p className="font-bold text-ink">{o.priority_score}/100</p></div><div><span className="text-slate">Effort</span><p className="font-bold text-ink">{o.effort}</p></div><div><span className="text-slate">Estimated hours saved</span><p className="font-bold text-ink">{o.estimated_hours_saved ?? "—"}</p></div><div><span className="text-slate">Agent</span><p className="font-bold text-ink">{o.recommended_agent || "To be assigned"}</p></div></div></Card>)}</div>
  </div>;
}
