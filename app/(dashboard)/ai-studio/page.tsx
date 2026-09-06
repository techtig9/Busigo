import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { getAIProviderStatus, PROVIDER_ORDER } from "@/lib/ai/provider";
import { getProviderCooldowns, getWorkspaceAIStats } from "@/lib/ai/observability";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {
  groq: "Groq",
  cerebras: "Cerebras",
  openrouter: "OpenRouter",
  anthropic: "Anthropic (Claude)",
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

  return (
    <div className="space-y-6">
      <PageHeader title="AI Studio" description="Turn business goals into auditable AI plans. Requests are routed Groq → Cerebras → OpenRouter → Anthropic,
          falling over only on rate-limit/quota responses — never silently on any other kind of failure." />

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Provider health</h2>
          <span className="text-xs text-slate">Last 30 days for this workspace · ${totalCostLast24h.toFixed(4)} est. cost, last 24h</span>
        </div>
        <div className="mt-3 divide-y divide-hairline">
          {PROVIDER_ORDER.map((name, index) => {
            const conf = configured.find((c) => c.provider === name);
            const cooldown = cooldownByProvider.get(name);
            const stat = statsByProvider.get(name);
            return (
              <div key={name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="flex items-center gap-2 font-medium text-ink">
                    <span className="text-xs text-slate">#{index + 1}</span>
                    {PROVIDER_LABELS[name]}
                    {!conf?.configured && <Badge tone="neutral">Not configured</Badge>}
                    {conf?.configured && cooldown?.isActive && <Badge tone="warning">Cooling down</Badge>}
                    {conf?.configured && !cooldown?.isActive && <Badge tone="success">Ready</Badge>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate">
                    {conf?.model ?? "—"}
                    {cooldown?.isActive && cooldown.coolingDownUntil ? ` · resumes ${formatDate(cooldown.coolingDownUntil)}` : ""}
                  </p>
                </div>
                <div className="flex gap-4 text-xs text-slate">
                  <span>{stat?.totalCalls ?? 0} calls</span>
                  <span>{stat?.failureCount ?? 0} errors</span>
                  <span>{stat?.failoverCount ?? 0} failovers</span>
                  <span>{stat?.avgLatencyMs != null ? `${stat.avgLatencyMs}ms avg` : "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
        {configured.every((c) => !c.configured) && (
          <p className="mt-3 text-xs text-danger">No AI provider is configured. Add GROQ_API_KEY at minimum.</p>
        )}
      </Card>

      <Card>
        <form action="/api/ai/plan" method="post" className="space-y-4">
          <Input name="task" placeholder="Describe what you want BusiGo to accomplish..." required />
          <Button type="submit">Generate AI plan</Button>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="font-semibold text-ink">Real AI, real failover</h2>
          <p className="mt-2 text-sm text-slate">Four-provider routing with structured JSON output and business context — see the table above for what&apos;s actually happening right now.</p>
        </Card>
        <Card>
          <h2 className="font-semibold text-ink">Connected execution</h2>
          <p className="mt-2 text-sm text-slate">Gmail, Calendar, Sheets, Slack, HubSpot, Notion and Airtable adapter contracts.</p>
        </Card>
        <Card>
          <h2 className="font-semibold text-ink">Safe by default</h2>
          <p className="mt-2 text-sm text-slate">External, financial, legal and destructive operations stay approval-gated.</p>
        </Card>
      </div>
    </div>
  );
}
