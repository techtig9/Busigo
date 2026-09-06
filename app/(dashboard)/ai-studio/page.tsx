import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Metric, MetricStrip } from "@/components/patterns/Metric";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { getAIProviderStatus, PROVIDER_ORDER } from "@/lib/ai/provider";
import { getProviderCooldowns, getWorkspaceAIStats } from "@/lib/ai/observability";
import { formatDate } from "@/lib/utils";
import { AiStudioTabs } from "./AiStudioTabs";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {
  groq: "Groq",
  cerebras: "Cerebras",
  openrouter: "OpenRouter",
  anthropic: "Anthropic (Claude)",
};

const PROVIDER_ROLE: Record<string, string> = {
  groq: "Primary",
  cerebras: "Fallback 1",
  openrouter: "Fallback 2",
  anthropic: "Fallback 3 · complex tasks",
};

export default async function AIStudioPage() {
  const { workspace } = await getWorkspaceContext();
  const [configured, cooldowns, stats] = await Promise.all([
    Promise.resolve(getAIProviderStatus()),
    getProviderCooldowns(),
    getWorkspaceAIStats(workspace.id),
  ]);

  const statsByProvider = new Map(stats.map((s) => [s.provider, s]));
  const cooldownByProvider = new Map(cooldowns.map((c) => [c.provider, c]));
  const totalCostLast24h = stats.reduce((sum, s) => sum + s.last24hCost, 0);
  const totalCalls = stats.reduce((s, x) => s + (x.totalCalls ?? 0), 0);
  const totalFailovers = stats.reduce((s, x) => s + (x.failoverCount ?? 0), 0);
  const totalErrors = stats.reduce((s, x) => s + (x.failureCount ?? 0), 0);
  const activeProvider = PROVIDER_ORDER.find(
    (n) => configured.find((c) => c.provider === n)?.configured && !cooldownByProvider.get(n)?.isActive
  );
  const noneConfigured = configured.every((c) => !c.configured);

  const providers = (
    <>
      <div className="divide-y divide-hairline">
        {PROVIDER_ORDER.map((name, index) => {
          const conf = configured.find((c) => c.provider === name);
          const cooldown = cooldownByProvider.get(name);
          const stat = statsByProvider.get(name);
          return (
            <div key={name} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  <span className="tabular text-xs text-muted">#{index + 1}</span>
                  {PROVIDER_LABELS[name]}
                  {name === activeProvider && <Badge tone="signal">Active</Badge>}
                  {!conf?.configured && <Badge tone="neutral">Not configured</Badge>}
                  {conf?.configured && cooldown?.isActive && <Badge tone="warning">Cooling down</Badge>}
                  {conf?.configured && !cooldown?.isActive && <Badge tone="success">Ready</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {PROVIDER_ROLE[name]} · {conf?.model ?? "no model"}
                  {cooldown?.isActive && cooldown.coolingDownUntil
                    ? ` · resumes ${formatDate(cooldown.coolingDownUntil)}`
                    : ""}
                </p>
              </div>
              <div className="tabular flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate">
                <span>{stat?.totalCalls ?? 0} calls</span>
                <span>{stat?.failureCount ?? 0} errors</span>
                <span>{stat?.failoverCount ?? 0} failovers</span>
                <span>{stat?.avgLatencyMs != null ? `${stat.avgLatencyMs}ms avg` : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
      {noneConfigured && (
        <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          No AI provider is configured. Add <code className="font-mono">GROQ_API_KEY</code> at minimum — the other three
          are optional fallbacks.
        </p>
      )}
      <p className="mt-4 text-xs text-muted">
        Requests fail over only on rate-limit or quota responses (HTTP 429, and 402 where it clearly means exhausted
        billing). A bad key, a malformed request or an application bug never triggers failover — those surface as real
        errors instead of being masked by a silent retry on another provider. No key is ever exposed to the browser.
      </p>
    </>
  );

  const playground = (
    <form action="/api/ai/plan" method="post" className="max-w-xl space-y-3">
      <div>
        <Label htmlFor="ai-task">Objective</Label>
        <Input id="ai-task" name="task" placeholder="Describe what you want BusiGo to accomplish…" required />
      </div>
      <Button type="submit">Generate AI plan</Button>
      <p className="text-xs text-muted">
        Produces a structured, auditable plan. Nothing runs from here — the plan is for you to review.
      </p>
    </form>
  );

  const routing = (
    <div className="space-y-4">
      <ol className="space-y-2">
        {PROVIDER_ORDER.map((name, i) => (
          <li key={name} className="flex items-center gap-3 rounded-lg border border-hairline p-3">
            <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-slate">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{PROVIDER_LABELS[name]}</p>
              <p className="text-xs text-muted">{PROVIDER_ROLE[name]}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        This order is fixed in <code className="font-mono">lib/ai/provider.ts</code>. Claude also handles work explicitly
        routed to it for difficult, large or long-context tasks, not only failover.
      </p>
    </div>
  );

  const usage = (
    <div className="space-y-4">
      <MetricStrip className="lg:grid-cols-4">
        <Metric label="Requests" value={totalCalls} hint="last 30 days" />
        <Metric label="Errors" value={totalErrors} goodDirection="down" />
        <Metric label="Failovers" value={totalFailovers} goodDirection="down" />
        <Metric label="Est. cost" value={`$${totalCostLast24h.toFixed(4)}`} hint="last 24h" />
      </MetricStrip>
      <p className="text-xs text-muted">
        Every request records provider, model, latency, token estimate, outcome, failover reason and cost estimate.
        Prompt and business context are redacted before storage.
      </p>
    </div>
  );

  return (
    <>
      <PageHeader
        title="AI Studio"
        description="Which provider served your requests, what it cost, and what happens when one runs out of quota."
      />
      <AiStudioTabs providers={providers} playground={playground} routing={routing} usage={usage} />

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card density="compact">
          <CardTitle>Real failover, not a retry</CardTitle>
          <CardDescription>
            Four-provider routing with structured output and business context — the Providers tab shows what is actually
            happening right now.
          </CardDescription>
        </Card>
        <Card density="compact">
          <CardTitle>Connected execution</CardTitle>
          <CardDescription>
            Gmail, Calendar, Sheets, Slack, HubSpot, Notion and Airtable adapters are available to AI steps.
          </CardDescription>
        </Card>
        <Card density="compact">
          <CardTitle>Safe by default</CardTitle>
          <CardDescription>
            External, financial, legal and destructive operations stay approval-gated regardless of provider.
          </CardDescription>
        </Card>
      </div>
    </>
  );
}
