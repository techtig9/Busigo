import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BusinessPhaseBar } from "@/components/dashboard/BusinessPhaseBar";
import { recordOutcomeAction, createGrowthRecommendationAction, createExperimentAction } from "@/lib/actions/measure-grow";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function GrowthPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const [{ data: outcomes }, { data: recommendations }, { data: experiments }, { data: forecasts }, { data: benchmarks }] = await Promise.all([
    supabase.from("business_outcomes").select("*").eq("workspace_id", workspace.id).order("occurred_at", { ascending: false }).limit(8),
    supabase.from("growth_recommendations").select("*").eq("workspace_id", workspace.id).order("expected_impact", { ascending: false }).limit(8),
    supabase.from("growth_experiments").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("business_forecasts").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("business_benchmarks").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(6),
  ]);
  const totalValue = (outcomes || []).reduce((sum: number, x: any) => sum + Number(x.value || 0), 0);
  const activeExperiments = (experiments || []).filter((x: any) => x.status === "running").length;
  const topRecommendation = (recommendations || [])[0];
  return <div className="space-y-6">
    <PageHeader title="Measure & Grow" description="Turn business activity into measurable outcomes, growth experiments and decisions." />
    <BusinessPhaseBar current={5}/>
    <div className="grid gap-4 sm:grid-cols-4">
      <Card><p className="text-xs uppercase text-slate">Verified outcomes</p><p className="mt-2 text-3xl font-bold text-ink">{outcomes?.length || 0}</p></Card>
      <Card><p className="text-xs uppercase text-slate">Value tracked</p><p className="mt-2 text-3xl font-bold text-ink">{totalValue.toLocaleString()}</p></Card>
      <Card><p className="text-xs uppercase text-slate">Growth ideas</p><p className="mt-2 text-3xl font-bold text-ink">{recommendations?.length || 0}</p></Card>
      <Card><p className="text-xs uppercase text-slate">Active experiments</p><p className="mt-2 text-3xl font-bold text-ink">{activeExperiments}</p></Card>
    </div>
    <Card><div className="flex items-center justify-between"><div><h2 className="font-bold text-ink">AI Growth Engine</h2><p className="text-sm text-slate">Measure what changed, recommend what to improve, then test it.</p></div><Badge tone="signal">Outcome-driven</Badge></div>
      <div className="mt-4 rounded border border-hairline bg-surface p-4"><p className="text-xs uppercase text-slate">Top opportunity</p><p className="mt-1 font-semibold text-ink">{topRecommendation?.title || "Add a growth recommendation to start the experiment loop."}</p><p className="mt-1 text-sm text-slate">{topRecommendation?.description || "BusiGo can generate these from connected CRM, marketing, support and finance signals as those integrations are populated."}</p></div>
    </Card>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><h2 className="font-bold text-ink">Record a verified outcome</h2><form action={recordOutcomeAction} className="mt-4 space-y-3"><Input name="title" required placeholder="e.g. Lead follow-up recovered" /><div className="grid grid-cols-2 gap-3"><Select name="outcome_type" ><option value="hours_saved">Hours saved</option><option value="cost_saved">Cost saved</option><option value="revenue_influenced">Revenue influenced</option><option value="leads_recovered">Leads recovered</option><option value="tickets_resolved">Tickets resolved</option><option value="invoices_collected">Invoices collected</option></Select><Input name="value" type="number" step="any" required placeholder="Value" /></div><Input name="unit" placeholder="Unit, e.g. USD or hours" /><Button type="submit">Save outcome</Button></form></Card>
      <Card><h2 className="font-bold text-ink">Create growth recommendation</h2><form action={createGrowthRecommendationAction} className="mt-4 space-y-3"><Input name="title" required placeholder="e.g. Reactivate inactive customers" /><Textarea name="description" required placeholder="What should improve and why?" /><div className="grid grid-cols-2 gap-3"><Select name="category" ><option value="acquisition">Acquisition</option><option value="conversion">Conversion</option><option value="retention">Retention</option><option value="pricing">Pricing</option><option value="operations">Operations</option><option value="marketing">Marketing</option><option value="sales">Sales</option></Select><Select name="effort" ><option value="low">Low effort</option><option value="medium">Medium effort</option><option value="high">High effort</option></Select></div><Input name="expected_impact" type="number" step="any" placeholder="Expected impact" /><Button type="submit">Add recommendation</Button></form></Card>
    </div>
    <div className="grid gap-6 lg:grid-cols-3">
      <Card><h2 className="font-bold text-ink">Forecasts</h2>{forecasts?.length ? <div className="mt-3 space-y-3">{forecasts.map((x: any) => <div key={x.id} className="rounded border border-hairline p-3"><p className="text-sm font-semibold text-ink">{x.metric}</p><p className="text-sm text-slate">{x.horizon}: {x.forecast_value}</p></div>)}</div> : <p className="mt-3 text-sm text-slate">Forecast records will appear here when connected data is available.</p>}</Card>
      <Card><h2 className="font-bold text-ink">Benchmarks</h2>{benchmarks?.length ? <div className="mt-3 space-y-3">{benchmarks.map((x: any) => <div key={x.id} className="rounded border border-hairline p-3"><p className="text-sm font-semibold text-ink">{x.metric}</p><p className="text-sm text-slate">Business: {x.business_value} · Benchmark: {x.benchmark_value ?? "—"}</p></div>)}</div> : <p className="mt-3 text-sm text-slate">Industry or internal benchmarks will appear after enough comparable data exists.</p>}</Card>
      <Card><h2 className="font-bold text-ink">Start an experiment</h2><form action={createExperimentAction} className="mt-3 space-y-2"><Input name="name" required placeholder="Experiment name" /><Input name="hypothesis" required placeholder="Hypothesis" /><Input name="metric" required placeholder="Success metric" /><div className="grid grid-cols-2 gap-2"><Input name="baseline" type="number" step="any" placeholder="Baseline" /><Input name="target" type="number" step="any" placeholder="Target" /></div><Button type="submit">Create experiment</Button></form></Card>
    </div>
    <Card><h2 className="font-bold text-ink">Recent outcomes</h2>{outcomes?.length ? <div className="mt-3 divide-y divide-hairline">{outcomes.map((x: any) => <div key={x.id} className="flex items-center justify-between py-3 text-sm"><span className="text-slate">{x.title}</span><strong className="text-ink">{x.value} {x.unit || ""}</strong></div>)}</div> : <p className="mt-3 text-sm text-slate">No verified outcomes yet. Record the results of your automations here so BusiGo can measure value.</p>}</Card>
  </div>;
}
