"use client";

import { useState } from "react";
import { Network, AlertTriangle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea, Label } from "@/components/ui/Input";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SignalPulse, EvidenceChip } from "@/components/patterns/Signals";

interface PlanTask {
  id: string;
  title: string;
  role: string;
  risk: string;
  approvalRequired?: boolean;
}

const RISK_TONE: Record<string, "danger" | "warn" | "slate"> = {
  high: "danger",
  critical: "danger",
  medium: "warn",
  low: "slate",
};

/**
 * This screen previously carried styling from a different design system entirely —
 * `text-muted-foreground`, `bg-background`, bare `border`, `bg-black`. Those are shadcn token
 * names that do not exist in this Tailwind config, so they compiled to nothing and the text
 * rendered unstyled; the bare `border` and `bg-black` did not adapt to dark mode at all.
 * Rebuilt on BusiGo's own primitives. The API call and its contract are unchanged.
 */
export default function AgentOrchestrationPage() {
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<{ tasks?: PlanTask[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setPlan(null);
    try {
      const r = await fetch("/api/agents/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      setPlan(await r.json());
    } catch {
      setPlan({ error: "Couldn't reach the orchestrator. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  const tasks = plan?.tasks ?? [];
  const approvals = tasks.filter((t) => t.approvalRequired).length;

  return (
    <>
      <PageHeader
        title="Agent Orchestration"
        description="Coordinate several AI workers around one business objective, with explicit dependencies, risk levels and approval gates."
      />

      <Card className="mb-4">
        <CardTitle>Business objective</CardTitle>
        <CardDescription>
          Describe the outcome you want. BusiGo drafts a plan — nothing executes until you review it.
        </CardDescription>
        <div className="mt-3">
          <Label htmlFor="orchestration-goal">Objective</Label>
          <Textarea
            id="orchestration-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Example: Find qualified leads, follow up, update the CRM, and prepare a weekly report."
            className="min-h-28"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={run} loading={loading} disabled={!goal.trim()}>
            Build agent plan
          </Button>
          {loading && <span className="text-xs text-slate">Planning…</span>}
        </div>
        {loading && (
          <div className="mt-3">
            <SignalPulse active label="Building the agent plan" />
          </div>
        )}
      </Card>

      {plan?.error && (
        <Card>
          <ErrorState body={plan.error} onRetry={run} />
        </Card>
      )}

      {!plan && !loading && (
        <Card>
          <EmptyState
            icon={Network}
            title="No plan yet"
            body="Describe an objective above and BusiGo will break it into tasks, assign each to a specialist role, and mark which ones need your approval before they can run."
          />
        </Card>
      )}

      {tasks.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">Proposed plan</h2>
            <Badge tone="slate">{tasks.length} tasks</Badge>
            {approvals > 0 && (
              <Badge tone="warn">
                <ShieldCheck size={11} aria-hidden />
                {approvals} need approval
              </Badge>
            )}
          </div>
          <ol className="space-y-2.5">
            {tasks.map((t, i) => (
              <li key={t.id ?? i}>
                <Card density="compact">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-ink">
                      <span className="tabular text-muted">{i + 1}.</span> {t.title}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={RISK_TONE[t.risk] ?? "slate"}>
                        <AlertTriangle size={11} aria-hidden />
                        {t.risk} risk
                      </Badge>
                      {t.approvalRequired && <Badge tone="warn">approval required</Badge>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <EvidenceChip label={`Role: ${t.role}`} href="/workforce" />
                    {t.approvalRequired && <EvidenceChip label="Gated by Approvals" href="/approvals" />}
                  </div>
                </Card>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">
            This is a draft plan. Tasks marked &ldquo;approval required&rdquo; will wait in the Approval Center before
            anything runs.
          </p>
        </>
      )}
    </>
  );
}
