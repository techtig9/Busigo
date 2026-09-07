import Link from "next/link";
import { Check, ArrowRight, Plug, Sparkles, Workflow, Rocket, Target, Building2 } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { getBusinessContext } from "@/lib/business-os";
import { saveBusinessProfileAction, saveDiscoveryAnswerAction } from "@/lib/actions/business-os";
import { getOnboardingStep, setOnboardingStepAction, finishOnboardingAction } from "@/lib/actions/onboarding";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Controls";
import { AnalyzeBusinessButton } from "@/components/business-os/AnalyzeBusinessButton";
import { OnboardingStepper } from "./OnboardingStepper";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get started" };

/**
 * Guided first-value flow (spec §3, §5).
 *
 * Every step is judged complete by REAL state — a business row exists, an app is connected, a
 * workflow is published — not by whether someone clicked Next. A wizard that lets you tick
 * boxes without doing the work reports progress that isn't there, and the completion score
 * would be fiction.
 *
 * Each control performs its actual action: the business and goals steps post to the same
 * server actions Business Brain uses, Analyze runs the real analyzer, and Connect/Automate
 * hand off to the real pages rather than simulating them.
 */
export default async function OnboardingPage({ searchParams }: { searchParams: { step?: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();

  const [{ business, goals, opportunities }, { data: workflows }, { data: connectionCount }, { data: answers }, savedStep] =
    await Promise.all([
      getBusinessContext(workspace.id),
      supabase.from("workflows").select("id, status").eq("workspace_id", workspace.id),
      supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
        .then((r) => ({ data: r.count ?? 0 })),
      supabase
        .from("business_discovery_answers")
        .select("question_key, answer")
        .eq("workspace_id", workspace.id)
        .eq("question_key", "success")
        .maybeSingle(),
      getOnboardingStep(),
    ]);

  const workflowRows = workflows || [];
  const published = workflowRows.filter((w) => w.status === "published").length;

  const steps = [
    {
      id: "business",
      label: "Business",
      icon: Building2,
      done: !!business?.name && !!business?.industry,
      hint: "Tell BusiGo what the company does",
    },
    {
      id: "goals",
      label: "Goals",
      icon: Target,
      done: !!answers?.answer,
      hint: "What you're trying to achieve",
    },
    {
      id: "connect",
      label: "Connect",
      icon: Plug,
      done: (connectionCount ?? 0) > 0,
      hint: "Link the tools you already use",
    },
    {
      id: "analyze",
      label: "Analyze",
      icon: Sparkles,
      done: opportunities.length > 0,
      hint: "Let BusiGo find what's worth automating",
    },
    {
      id: "automate",
      label: "Automate",
      icon: Workflow,
      done: workflowRows.length > 0,
      hint: "Build your first workflow",
    },
    {
      id: "launch",
      label: "Launch",
      icon: Rocket,
      done: published > 0,
      hint: "Publish it and go live",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const score = Math.round((doneCount / steps.length) * 100);

  // The URL wins over the stored cursor, so the stepper's links work; otherwise resume where
  // they left off, and failing that jump to the first thing not yet done.
  const firstIncomplete = steps.findIndex((s) => !s.done);
  const requested = Number(searchParams.step);
  const active = Number.isFinite(requested) && requested >= 0 && requested < steps.length
    ? requested
    : savedStep > 0
      ? Math.min(savedStep, steps.length - 1)
      : firstIncomplete === -1
        ? steps.length - 1
        : firstIncomplete;

  const step = steps[active];

  return (
    <>
      <PageHeader
        title="Get started"
        description="Six steps to your first working automation. You can leave and come back — progress is measured from what actually exists, not from clicking through."
        actions={
          <form action={finishOnboardingAction}>
            <Button type="submit" variant="ghost">
              Skip for now
            </Button>
          </form>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>
            {doneCount} of {steps.length} complete
          </CardTitle>
          <span className="tabular text-sm font-semibold text-slate">{score}%</span>
        </div>
        <Progress value={score} label="Onboarding progress" className="mt-2" tone={score === 100 ? "success" : "signal"} />
      </Card>

      <OnboardingStepper
        steps={steps.map((s, i) => ({ id: s.id, label: s.label, done: s.done, index: i }))}
        active={active}
        onSelectAction={setOnboardingStepAction}
      />

      <Card className="mt-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              step.done ? "bg-success-soft text-success-ink" : "bg-signal-soft text-signal-ink"
            )}
          >
            {step.done ? <Check size={18} aria-hidden /> : <step.icon size={18} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">
              Step {active + 1} · {step.label}
            </CardTitle>
            <CardDescription>{step.hint}</CardDescription>
          </div>
        </div>

        <div className="mt-5">
          {step.id === "business" && (
            <form action={saveBusinessProfileAction} className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ob-name">Business name</Label>
                <Input id="ob-name" name="name" required defaultValue={business?.name || ""} />
              </div>
              <div>
                <Label htmlFor="ob-industry">Industry</Label>
                <Input id="ob-industry" name="industry" required defaultValue={business?.industry || ""} placeholder="e.g. Marketing agency" />
              </div>
              <div>
                <Label htmlFor="ob-website">Website</Label>
                <Input id="ob-website" name="website" defaultValue={business?.website || ""} placeholder="https://" />
              </div>
              <div>
                <Label htmlFor="ob-team">Team size</Label>
                <Input id="ob-team" name="team_size" type="number" min={0} defaultValue={business?.team_size || ""} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ob-desc">What does the business do?</Label>
                <Textarea id="ob-desc" name="description" defaultValue={business?.description || ""} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Save and continue</Button>
              </div>
            </form>
          )}

          {step.id === "goals" && (
            <form action={saveDiscoveryAnswerAction} className="space-y-3">
              <input type="hidden" name="key" value="success" />
              <div>
                <Label htmlFor="ob-goals">What are your most important goals for the next 3, 6 and 12 months?</Label>
                <Textarea id="ob-goals" name="answer" required defaultValue={answers?.answer || ""} placeholder="More qualified leads, faster support responses, fewer manual reports…" />
              </div>
              <Button type="submit">Save and continue</Button>
              <p className="text-xs text-muted">
                Saved to Business Brain — this is the same answer as the interview question, not a duplicate.
              </p>
            </form>
          )}

          {step.id === "connect" && (
            <div className="space-y-3">
              <p className="text-sm text-slate">
                {(connectionCount ?? 0) > 0
                  ? `${connectionCount} app${connectionCount === 1 ? "" : "s"} connected. Your workflows and agents can act through them, within the permissions you grant.`
                  : "Connect Gmail, Slack, Sheets, HubSpot, Notion or Airtable so workflows and agents can read and act through them."}
              </p>
              <Button href="/connections">
                {(connectionCount ?? 0) > 0 ? "Manage connections" : "Connect an app"} <ArrowRight size={14} />
              </Button>
            </div>
          )}

          {step.id === "analyze" && (
            <div className="space-y-3">
              <p className="text-sm text-slate">
                {opportunities.length > 0
                  ? `BusiGo has ranked ${opportunities.length} opportunit${opportunities.length === 1 ? "y" : "ies"} from what it knows so far.`
                  : "BusiGo reads what you've told it — and your website, if you gave one — and ranks what's worth automating first."}
              </p>
              <div className="flex flex-wrap gap-2">
                <AnalyzeBusinessButton />
                {opportunities.length > 0 && (
                  <Button variant="secondary" href="/opportunities">
                    View opportunities
                  </Button>
                )}
              </div>
            </div>
          )}

          {step.id === "automate" && (
            <div className="space-y-3">
              <p className="text-sm text-slate">
                {workflowRows.length > 0
                  ? `You have ${workflowRows.length} workflow${workflowRows.length === 1 ? "" : "s"}. Open one to keep building, or start another.`
                  : "A workflow turns a trigger — a webhook, a schedule, or a form — into a traced sequence of steps."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button href="/workflows/new">
                  New workflow <ArrowRight size={14} />
                </Button>
                {opportunities[0] && (
                  <Button variant="secondary" href="/automation-center">
                    Draft one with AI
                  </Button>
                )}
              </div>
            </div>
          )}

          {step.id === "launch" && (
            <div className="space-y-3">
              <p className="text-sm text-slate">
                {published > 0
                  ? `${published} workflow${published === 1 ? " is" : "s are"} published and accepting triggers. Every run is traced under Runs.`
                  : "Publishing makes a workflow live — its trigger starts accepting real events immediately. You can unpublish at any time."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button href="/workflows">{published > 0 ? "View workflows" : "Publish a workflow"}</Button>
                {published > 0 && (
                  <form action={finishOnboardingAction}>
                    <Button type="submit" variant="secondary">
                      Finish setup
                    </Button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {doneCount === steps.length && (
        <Card className="mt-4 border-success/30 bg-success-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>You&apos;re set up</CardTitle>
              <CardDescription>
                A published workflow, a connected app and a ranked opportunity list. The Command Center takes it from
                here.
              </CardDescription>
            </div>
            <form action={finishOnboardingAction}>
              <Button type="submit">Go to Command Center</Button>
            </form>
          </div>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted">
        Prefer to explore on your own?{" "}
        <Link href="/dashboard" className="text-signal hover:underline">
          Go straight to the Command Center
        </Link>
        .
      </p>
    </>
  );
}
