import Link from "next/link";
import { ArrowRight, Workflow, Bot, CheckSquare, Lightbulb, Plug } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { getBusinessContext } from "@/lib/business-os";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { Progress } from "@/components/ui/Controls";
import { Metric, MetricStrip } from "@/components/patterns/Metric";
import { TrendChart, type TrendPoint } from "@/components/patterns/TrendChart";
import { SignalPulse, AiCallout, EvidenceChip } from "@/components/patterns/Signals";
import { OnboardingChecklist, type ChecklistItem } from "@/components/dashboard/OnboardingChecklist";
import { PLAN_CREDITS, planLabel } from "@/lib/plans";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const DAY_MS = 86_400_000;
const TREND_DAYS = 14;

/** Daily success rate over the trailing fortnight, from real run rows. */
function buildTrend(runs: { status: string; started_at: string }[]): TrendPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = new Map<string, { total: number; ok: number }>();
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    buckets.set(new Date(today.getTime() - i * DAY_MS).toDateString(), { total: 0, ok: 0 });
  }

  for (const r of runs) {
    const key = new Date(r.started_at);
    key.setHours(0, 0, 0, 0);
    const bucket = buckets.get(key.toDateString());
    if (!bucket) continue;
    // A run stopped by a filter is a correct outcome, not a failure — counting it against the
    // success rate would make a well-designed filter look like a broken workflow.
    if (r.status === "running" || r.status === "waiting") continue;
    bucket.total += 1;
    if (r.status === "success" || r.status === "stopped_by_filter") bucket.ok += 1;
  }

  return Array.from(buckets.entries()).map(([key, b]) => {
    const d = new Date(key);
    return {
      label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      value: b.total === 0 ? 0 : Math.round((b.ok / b.total) * 100),
      detail: b.total === 0 ? "no runs" : `${b.ok}/${b.total} runs`,
    };
  });
}

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();

  const since = new Date(Date.now() - TREND_DAYS * DAY_MS).toISOString();

  const [
    { data: profile },
    { data: workflows },
    { data: sub },
    { data: recentRuns },
    { data: trendRuns },
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
      .limit(6),
    supabase
      .from("workflow_runs")
      .select("status, started_at, workflows!inner(workspace_id)")
      .eq("workflows.workspace_id", workspace.id)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(1000),
    supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .then((r) => ({ data: r.count ?? 0 })),
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .then((r) => ({ data: r.count ?? 0 })),
    supabase
      .from("workspace_settings")
      .select("value")
      .eq("workspace_id", workspace.id)
      .eq("key", "onboarding_dismissed")
      .maybeSingle(),
  ]);

  // Previously called with `user.id`. getBusinessContext filters on workspace_id, so passing a
  // user id matched nothing and the agents / opportunities / approvals / KPI panels on this
  // page were permanently empty regardless of the workspace's real contents. Every other call
  // site in the app already passed workspace.id.
  const os = await getBusinessContext(workspace.id);

  const plan = (sub?.plan as any) || "free";
  const creditsTotal = PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] ?? 500;
  const creditsRemaining = sub?.credits_remaining ?? 0;

  const workflowCount = workflows?.length ?? 0;
  const publishedCount = workflows?.filter((w) => w.status === "published").length ?? 0;
  const hasRun = (recentRuns?.length ?? 0) > 0;
  const firstName = (profile?.name || "there").split(" ")[0];

  const trend = buildTrend(trendRuns || []);
  const finished = (trendRuns || []).filter((r: any) => r.status !== "running" && r.status !== "waiting");
  const succeeded = finished.filter((r: any) => r.status === "success" || r.status === "stopped_by_filter").length;
  const successRate = finished.length ? Math.round((succeeded / finished.length) * 100) : null;
  const failures = finished.filter((r: any) => r.status === "failed").length;
  const liveRuns = (recentRuns || []).filter((r: any) => r.status === "running").length;

  const topOpportunity = os.opportunities[0];
  const activeAgents = os.agents.filter((a: any) => a.status === "active").length;

  const onboardingSteps: ChecklistItem[] = [
    { label: "Create your first workflow", done: workflowCount > 0, href: "/workflows/new" },
    { label: "Publish it", done: publishedCount > 0, href: "/workflows" },
    { label: "Trigger a test run", done: hasRun, href: "/workflows" },
    { label: "Invite a teammate", done: (memberCount ?? 0) > 1, href: "/settings" },
    { label: "Connect an app", done: (connectionCount ?? 0) > 0, href: "/connections" },
  ];
  const showOnboarding = !onboardingSetting?.value && onboardingSteps.some((s) => !s.done);

  return (
    <>
      <PageHeader
        title={`${timeGreeting()}, ${firstName}`}
        description="What's happening across your workspace right now."
        actions={
          <>
            <Button variant="secondary" href="/opportunities">
              View opportunities
            </Button>
            <Button href="/workflows/new">New workflow</Button>
          </>
        }
      />

      {/* Live-execution indicator: present only while runs are genuinely in flight. */}
      {liveRuns > 0 && (
        <div className="mb-4">
          <SignalPulse active label={`${liveRuns} workflow ${liveRuns === 1 ? "run" : "runs"} executing`} />
          <p className="mt-1.5 text-xs font-medium text-pulse">
            {liveRuns} {liveRuns === 1 ? "run" : "runs"} executing now
          </p>
        </div>
      )}

      {showOnboarding && (
        <div className="mb-4">
          <OnboardingChecklist items={onboardingSteps} />
        </div>
      )}

      <MetricStrip className="mb-4">
        <Metric label="Workflows" value={workflowCount} hint={`${publishedCount} published`} />
        <Metric
          label="Automation success"
          value={successRate === null ? "—" : successRate}
          suffix={successRate === null ? undefined : "%"}
          hint={successRate === null ? "no finished runs yet" : `last ${TREND_DAYS} days`}
        />
        <Metric label="Failures" value={failures} hint={`last ${TREND_DAYS} days`} />
        <Metric label="Open approvals" value={os.approvals.length} hint={os.approvals.length ? "needs review" : "all clear"} />
        <Metric
          label="Credits"
          value={creditsRemaining.toLocaleString()}
          suffix={`/ ${creditsTotal.toLocaleString()}`}
          footer={
            <Progress
              value={creditsRemaining}
              max={creditsTotal}
              label="Credits remaining"
              tone={creditsRemaining / creditsTotal < 0.15 ? "danger" : creditsRemaining / creditsTotal < 0.35 ? "warn" : "signal"}
            />
          }
        />
      </MetricStrip>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Automation health</CardTitle>
              <CardDescription>
                Daily success rate across finished runs. Runs stopped by a filter count as successful — that is the
                filter working, not a failure.
              </CardDescription>
            </div>
            <Link href="/runs" className="shrink-0 text-sm text-signal hover:underline">
              All runs
            </Link>
          </CardHeader>
          <TrendChart data={trend} unit="%" yMax={100} title={`Daily automation success rate, last ${TREND_DAYS} days`} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <ul className="space-y-2.5 text-sm">
            <AttentionRow
              icon={CheckSquare}
              label="Approvals waiting"
              count={os.approvals.length}
              href="/approvals"
              urgent={os.approvals.length > 0}
            />
            <AttentionRow icon={Workflow} label="Failed runs" count={failures} href="/runs" urgent={failures > 0} />
            <AttentionRow
              icon={Plug}
              label="Connected apps"
              count={connectionCount ?? 0}
              href="/connections"
              urgent={(connectionCount ?? 0) === 0}
            />
            <AttentionRow
              icon={Bot}
              label="Active agents"
              count={activeAgents}
              href="/workforce"
              urgent={os.agents.length > 0 && activeAgents === 0}
            />
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top opportunity</CardTitle>
            <Link href="/opportunities" className="shrink-0 text-sm text-signal hover:underline">
              View all
            </Link>
          </CardHeader>
          {topOpportunity ? (
            <>
              <AiCallout
                action={
                  <Button size="sm" variant="secondary" href="/opportunities">
                    Review
                  </Button>
                }
              >
                <span className="font-semibold">{topOpportunity.title}</span>
                <span className="mt-0.5 block text-xs text-slate">
                  {topOpportunity.impact} impact · {topOpportunity.effort} effort · priority{" "}
                  {topOpportunity.priority_score}/100
                </span>
              </AiCallout>
              {topOpportunity.description && (
                <p className="mt-3 text-sm text-slate">{topOpportunity.description}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <EvidenceChip label="Business Brain" href="/business-brain" />
                {topOpportunity.recommended_agent && (
                  <EvidenceChip label={`Agent: ${topOpportunity.recommended_agent}`} href="/workforce" />
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Lightbulb}
              title="No opportunities yet"
              body="BusiGo ranks automation opportunities once Business Brain knows how your business operates."
              action={{ label: "Open Business Brain", href: "/business-brain" }}
              className="py-8"
            />
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <Link href="/runs" className="shrink-0 text-sm text-signal hover:underline">
              View all
            </Link>
          </CardHeader>
          {!recentRuns || recentRuns.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="No runs yet"
              body="Publish a workflow and trigger it — every execution is traced here, step by step."
              action={{ label: "New workflow", href: "/workflows/new" }}
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {recentRuns.map((run: any) => (
                <li key={run.id}>
                  <Link
                    href={`/runs/${run.workflow_id}/${run.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded px-2 py-2.5 text-sm transition-colors duration-hover hover:bg-surface"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{run.workflows?.name}</span>
                      <span className="block text-xs text-muted">{formatDate(run.started_at)}</span>
                    </span>
                    <StatusBadge status={run.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted">
        Workspace plan: <span className="font-medium text-slate">{planLabel(plan)}</span> ·{" "}
        <Link href="/billing" className="text-signal hover:underline">
          Manage billing
        </Link>
      </p>
    </>
  );
}

function AttentionRow({
  icon: Icon,
  label,
  count,
  href,
  urgent,
}: {
  icon: typeof Workflow;
  label: string;
  count: number;
  href: string;
  urgent?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex items-center gap-2.5 rounded px-2 py-1.5 transition-colors duration-hover hover:bg-surface"
      >
        <Icon size={15} className={urgent ? "text-warn" : "text-muted"} aria-hidden />
        <span className="flex-1 truncate text-ink">{label}</span>
        <span className="tabular font-semibold text-ink">{count}</span>
        <ArrowRight size={13} className="text-muted" aria-hidden />
      </Link>
    </li>
  );
}
