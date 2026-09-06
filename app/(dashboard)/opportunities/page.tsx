import { Lightbulb, Plus } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { getBusinessContext } from "@/lib/business-os";
import { createOpportunityAction } from "@/lib/actions/business-os";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Label } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import { Metric, MetricStrip } from "@/components/patterns/Metric";
import { ImpactEffort, EvidenceChip, AiCallout } from "@/components/patterns/Signals";

export const dynamic = "force-dynamic";

const IMPACT_TONE: Record<string, "danger" | "warn" | "signal" | "slate"> = {
  critical: "danger",
  high: "warn",
  medium: "signal",
  low: "slate",
};

export default async function OpportunitiesPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const { opportunities, business } = await getBusinessContext(workspace.id);

  const highValue = opportunities.filter((o: any) => o.impact === "high" || o.impact === "critical").length;
  const quickWins = opportunities.filter(
    (o: any) => o.effort === "low" && (o.impact === "high" || o.impact === "critical")
  ).length;
  const totalHours = opportunities.reduce((sum: number, o: any) => sum + (o.estimated_hours_saved ?? 0), 0);

  return (
    <>
      <PageHeader
        title="AI Opportunities"
        description="The work worth automating first, ranked by what it's worth against what it costs to build."
      />

      {opportunities.length > 0 && (
        <MetricStrip className="mb-4 lg:grid-cols-4">
          <Metric label="Opportunities" value={opportunities.length} />
          <Metric label="High or critical impact" value={highValue} />
          <Metric label="Quick wins" value={quickWins} hint="high impact, low effort" />
          <Metric label="Est. hours saved" value={totalHours || "—"} hint="per month, if all shipped" />
        </MetricStrip>
      )}

      {quickWins > 0 && (
        <AiCallout className="mb-4">
          <span className="font-semibold">
            {quickWins} quick {quickWins === 1 ? "win" : "wins"} available.
          </span>{" "}
          High impact with low build effort — these are the ones to do first.
        </AiCallout>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {opportunities.length === 0 ? (
            <Card>
              <EmptyState
                icon={Lightbulb}
                title="No opportunities yet"
                body={
                  business
                    ? "Add the highest-value repetitive work you'd like to automate, and BusiGo will rank it by impact against effort."
                    : "Complete Business Brain first — opportunities are ranked against what BusiGo knows about how your business operates."
                }
                action={
                  business
                    ? undefined
                    : { label: "Open Business Brain", href: "/business-brain" }
                }
                secondaryAction={business ? undefined : { label: "Add one manually", href: "#add-opportunity" }}
              />
            </Card>
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-hairline">
                {opportunities.map((o: any) => (
                  <li key={o.id} className="p-4 transition-colors duration-hover hover:bg-surface/60 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-ink">{o.title}</h3>
                          <Badge tone={IMPACT_TONE[o.impact] ?? "slate"}>{o.impact} impact</Badge>
                        </div>
                        {o.description && <p className="mt-1 text-sm text-slate">{o.description}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-lg font-bold text-ink">{o.priority_score}</p>
                        <p className="text-[11px] text-muted">priority</p>
                      </div>
                    </div>

                    <div className="mt-3 max-w-sm">
                      <ImpactEffort impact={o.impact} effort={o.effort} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {o.estimated_hours_saved != null && (
                        <EvidenceChip label={`~${o.estimated_hours_saved}h saved / month`} />
                      )}
                      {o.recommended_agent && (
                        <EvidenceChip label={`Agent: ${o.recommended_agent}`} href="/workforce" />
                      )}
                      <EvidenceChip label="Business Brain" href="/business-brain" />
                    </div>

                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" href="/workflows/new">
                        Build automation
                      </Button>
                      <Button size="sm" variant="ghost" href="/automation-center">
                        Draft with AI
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card id="add-opportunity" className="h-fit">
          <CardHeader>
            <div>
              <CardTitle>Add an opportunity</CardTitle>
              <CardDescription>Stored as a business object so AI ranking can improve it later.</CardDescription>
            </div>
          </CardHeader>
          <form action={createOpportunityAction} className="space-y-3">
            <div>
              <Label htmlFor="opp-title">Title</Label>
              <Input id="opp-title" name="title" required placeholder="Qualify inbound leads automatically" />
            </div>
            <div>
              <Label htmlFor="opp-desc">What should improve?</Label>
              <Input id="opp-desc" name="description" placeholder="Sales spends 6h/week triaging form fills" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="opp-impact">Impact</Label>
                <Select id="opp-impact" name="impact" defaultValue="high">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="opp-effort">Effort</Label>
                <Select id="opp-effort" name="effort" defaultValue="medium">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="opp-score">Priority score</Label>
              <Input id="opp-score" type="number" name="priority_score" min={0} max={100} placeholder="0–100" />
            </div>
            <Button type="submit" className="w-full">
              <Plus size={15} /> Add opportunity
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
