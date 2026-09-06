import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function ScaleReliabilityPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const [{ data: jobs }, { data: health }, { data: dead }] = await Promise.all([
    supabase.from("system_jobs").select("id,status,job_type,attempts,max_attempts,created_at,updated_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("service_health_checks").select("service_name,status,latency_ms,checked_at").order("checked_at", { ascending: false }).limit(20),
    // dead_letter_jobs.user_id is nullable and unset for run/step dead-letters (see
    // lib/platform/reliability.ts's writeDeadLetter, added in Phase 3) — workspace_id is the
    // real scoping column now. The Runs page's "Dead-lettered steps" panel
    // (app/(dashboard)/runs/page.tsx) is the actively-maintained view of this same data with
    // a working replay action; this card is kept for the platform-level job-queue summary.
    supabase.from("dead_letter_jobs").select("id,job_id,reason,replayed_at,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const queued = (jobs || []).filter(j => j.status === "queued").length;
  const failed = (jobs || []).filter(j => j.status === "failed" || j.status === "dead_letter").length;
  const latestHealth = health?.[0];
  return <div className="space-y-6">
    <PageHeader title="Scale & Reliability" description="Production infrastructure for queues, retries, idempotency, health and observability." />
    <div className="grid gap-4 md:grid-cols-4">
      {[["Queue depth", queued], ["Recent failures", failed], ["Dead-letter jobs", dead?.length || 0], ["Latest health", latestHealth?.status || "unknown"]].map(([label,value]) => <div key={String(label)} className="rounded-xl border border-hairline bg-panel p-5"><p className="text-sm text-slate">{label}</p><p className="mt-2 text-2xl font-bold text-ink">{value}</p></div>)}
    </div>
    <section className="rounded-xl border border-hairline bg-panel p-5"><h2 className="text-lg font-bold text-ink">Reliability controls</h2><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{["Durable job queue", "Retry + backoff foundation", "Dead-letter isolation", "Idempotency protection", "Service health checks", "Platform metrics", "Tenant-safe queue access", "Failure recovery", "Production observability"].map(x => <div key={x} className="rounded-lg border border-hairline bg-canvas p-4 text-sm font-semibold text-ink">✓ {x}</div>)}</div></section>
    <section className="rounded-xl border border-hairline bg-panel p-5"><h2 className="text-lg font-bold text-ink">Recent jobs</h2><div className="mt-4 space-y-2">{(jobs || []).map(j => <div key={j.id} className="flex items-center justify-between rounded-lg border border-hairline p-3 text-sm"><span className="font-medium text-ink">{j.job_type}</span><span className="text-slate">{j.status} · {j.attempts}/{j.max_attempts}</span></div>)}{!jobs?.length && <p className="text-sm text-slate">No jobs recorded yet.</p>}</div></section>
    <section className="rounded-xl border border-hairline bg-panel p-5"><h2 className="text-lg font-bold text-ink">Service health history</h2><div className="mt-4 space-y-2">{(health || []).slice(0,10).map(h => <div key={`${h.service_name}-${h.checked_at}`} className="flex items-center justify-between rounded-lg border border-hairline p-3 text-sm"><span className="font-medium text-ink">{h.service_name}</span><span className="text-slate">{h.status} · {h.latency_ms ?? "—"} ms</span></div>)}{!health?.length && <p className="text-sm text-slate">Health checks appear after the platform health endpoint is called.</p>}</div></section>
  </div>;
}
