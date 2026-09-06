import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { PLAN_CREDITS, planLabel } from "@/lib/plans";
import Link from "next/link";
import { getBusinessContext } from "@/lib/business-os";
import { BusinessPhaseBar } from "@/components/dashboard/BusinessPhaseBar";
import { OnboardingChecklist, type ChecklistItem } from "@/components/dashboard/OnboardingChecklist";

export const dynamic = "force-dynamic";

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();

  const [
    { data: profile },
    { data: workflows },
    { data: sub },
    { data: recentRuns },
    { data: memberCount },
    { data: connectionCount },
    { data: onboardingSetting },
  ] = await Promise.all([
    supabase.from("users").select("name").eq("id", user.id).single(),
    supabase.from("workflows").select("id, status").eq("workspace_id", workspace.id),
    supabase.from("subscriptions").select("plan, credits_remaining").eq("workspace_id", workspace.id).single(),
    supabase
      .from("workflow_runs")
      .select("id, status, started_at, workflow_id, workflows!inner(name, workspace_id)")
      .eq("workflows.workspace_id", workspace.id)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).then((r) => ({ data: r.count ?? 0 })),
    supabase.from("connections").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).then((r) => ({ data: r.count ?? 0 })),
    supabase.from("workspace_settings").select("value").eq("workspace_id", workspace.id).eq("key", "onboarding_dismissed").maybeSingle(),
  ]);

  const os = await getBusinessContext(user.id);
  const plan = (sub?.plan as any) || "free";
  const creditsTotal = PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] ?? 500;
  const creditsRemaining = sub?.credits_remaining ?? 0;
  const pct = Math.min(100, Math.round((creditsRemaining / creditsTotal) * 100));

  const workflowCount = workflows?.length ?? 0;
  const publishedCount = workflows?.filter((w) => w.status === "published").length ?? 0;
  const hasRun = (recentRuns?.length ?? 0) > 0;
  const firstName = (profile?.name || "there").split(" ")[0];

  const onboardingSteps: ChecklistItem[] = [
    { label: "Create your first workflow", done: workflowCount > 0, href: "/workflows/new" },
    { label: "Publish it", done: publishedCount > 0, href: "/workflows" },
    { label: "Trigger a test run", done: hasRun, href: "/workflows" },
    { label: "Invite a teammate", done: (memberCount ?? 0) > 1, href: "/settings" },
    { label: "Connect an app", done: (connectionCount ?? 0) > 0, href: "/connections" },
  ];
  const showOnboarding = !onboardingSetting?.value && onboardingSteps.some((s) => !s.done);


  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BusinessPhaseBar current={os.business ? (os.agents.length ? 4 : 2) : 1} />

      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {timeGreeting()}, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-0.5 text-sm text-slate">Here&apos;s what&apos;s happening with your workflows.</p>
        </div>
        <Button href="/workflows/new">New workflow</Button>
      </div>

      {showOnboarding && <OnboardingChecklist items={onboardingSteps} />}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="animate-slide-up stagger-1 transition-shadow hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Workflows</p>
          <p className="mt-1 text-2xl font-bold text-ink">{workflowCount}</p>
        </Card>
        <Card className="animate-slide-up stagger-2 transition-shadow hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Plan</p>
          <p className="mt-1 text-2xl font-bold text-ink">{planLabel(plan)}</p>
        </Card>
        <Card className="animate-slide-up stagger-3 transition-shadow hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Business OS score</p>
          <p className="mt-1 text-2xl font-bold text-ink">{Math.min(100, (os.business ? 30 : 0) + Math.min(30, os.opportunities.length * 3) + Math.min(20, os.kpis.length * 2) + (os.agents.length ? 20 : 0))}/100</p>
        </Card>
        <Card className="animate-slide-up stagger-3 transition-shadow hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Credits remaining</p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {creditsRemaining.toLocaleString()} <span className="text-sm font-normal text-slate">/ {creditsTotal.toLocaleString()}</span>
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-surface">
            <div className="h-1.5 rounded-full bg-signal transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-slide-up stagger-4">
          <div className="flex items-center justify-between"><h2 className="font-bold text-ink">AI workforce</h2><Link href="/workforce" className="text-sm text-signal hover:underline">Manage</Link></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded bg-surface p-3"><span className="text-slate">Agents</span><p className="font-bold text-ink">{os.agents.length}</p></div>
            <div className="rounded bg-surface p-3"><span className="text-slate">Approvals</span><p className="font-bold text-ink">{os.approvals.length}</p></div>
          </div>
        </Card>
        <Card className="animate-slide-up stagger-4">
          <div className="flex items-center justify-between"><h2 className="font-bold text-ink">Top opportunity</h2><Link href="/opportunities" className="text-sm text-signal hover:underline">View all</Link></div>
          {os.opportunities[0] ? <><p className="mt-3 font-semibold text-ink">{os.opportunities[0].title}</p><p className="mt-1 text-sm text-slate">Priority {os.opportunities[0].priority_score}/100</p></> : <p className="mt-3 text-sm text-slate">Complete Business Brain to discover your first automation opportunity.</p>}
        </Card>
      </div>

      <Card className="animate-slide-up stagger-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-ink">Recent runs</h2>
          <Link href="/runs" className="text-sm text-signal hover:underline">View all</Link>
        </div>
        {!recentRuns || recentRuns.length === 0 ? (
          <p className="text-sm text-slate">No runs yet — publish a workflow and trigger it to see activity here.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {recentRuns.map((run: any) => (
              <li key={run.id} className="flex items-center justify-between py-2.5 text-sm transition-colors hover:bg-surface/60">
                <div>
                  <p className="font-semibold text-ink">{run.workflows?.name}</p>
                  <p className="text-xs text-slate">{formatDate(run.started_at)}</p>
                </div>
                <Badge tone={statusTone(run.status)}>{run.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
