import { ShieldCheck, AlertTriangle } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/business-os";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { updateApprovalAction } from "@/lib/actions/business-os";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { Metric, MetricStrip } from "@/components/patterns/Metric";
import { EvidenceChip } from "@/components/patterns/Signals";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RISK_TONE: Record<string, "danger" | "warn" | "signal" | "slate"> = {
  critical: "danger",
  high: "danger",
  medium: "warn",
  low: "slate",
};

/**
 * Renders the concrete action an approval would perform.
 *
 * Spec §14 is explicit: "Never hide the actual action behind vague labels." The payload is
 * the actual thing that will happen, so it is shown as formatted JSON rather than summarised
 * away — a reviewer approving "Send outreach" needs to see the recipients, not the verb.
 * It stays scrollable and monospaced so a large payload cannot push the decision buttons off
 * screen.
 */
function ProposedAction({ payload }: { payload: unknown }) {
  const json = JSON.stringify(payload ?? {}, null, 2);
  const empty = json === "{}" || json === "null";
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-semibold text-slate">Proposed action</p>
      {empty ? (
        <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn-ink">
          This request carries no action payload. Approve only if you know what it does.
        </p>
      ) : (
        <pre className="max-h-56 overflow-auto rounded-lg border border-hairline bg-surface p-3 font-mono text-xs leading-relaxed text-ink">
          {json}
        </pre>
      )}
    </div>
  );
}

export default async function ApprovalsPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const { approvals } = await getBusinessContext(workspace.id);

  const highRisk = approvals.filter((a: any) => a.risk_level === "high" || a.risk_level === "critical").length;
  const oldest = approvals.length
    ? approvals.reduce((a: any, b: any) => (new Date(a.created_at) < new Date(b.created_at) ? a : b))
    : null;

  return (
    <>
      <PageHeader
        title="Approval Center"
        description="High-impact AI actions wait here until a human approves them. Nothing below has run yet."
      />

      {approvals.length > 0 && (
        <MetricStrip className="mb-4 lg:grid-cols-3">
          <Metric label="Waiting" value={approvals.length} />
          <Metric label="High or critical risk" value={highRisk} />
          <Metric
            label="Oldest request"
            value={oldest ? formatDate(oldest.created_at).split(",")[0] : "—"}
            hint={oldest ? "still waiting" : undefined}
          />
        </MetricStrip>
      )}

      {approvals.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Nothing waiting for you"
            body="Agents cannot silently cross the approval boundary you configured — when one proposes a high-impact action, it appears here first."
            action={{ label: "Review agent policies", href: "/workforce" }}
            secondaryAction={{ label: "Autonomy settings", href: "/autonomous-ops" }}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((a: any) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <Badge tone={RISK_TONE[a.risk_level] ?? "slate"}>
                      <AlertTriangle size={11} aria-hidden />
                      {a.risk_level} risk
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">Requested {formatDate(a.created_at)}</p>
                </div>
              </CardHeader>

              {a.reason && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-slate">Why this was proposed</p>
                  <p className="text-sm text-slate">{a.reason}</p>
                </div>
              )}

              <ProposedAction payload={a.payload} />

              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.agent_id && <EvidenceChip label="Requesting agent" href="/workforce" />}
                <EvidenceChip label="Autonomy policy" href="/autonomous-ops" />
                <EvidenceChip label="Audit log" href="/security-governance" />
              </div>

              {/*
                Two separate forms, each bound to the real updateApprovalAction with its own
                decision — unchanged from the previous implementation. Reject is rendered
                first so the affirmative action is not the one under the cursor by default.
              */}
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
                <form
                  action={async () => {
                    "use server";
                    await updateApprovalAction(a.id, "rejected");
                  }}
                >
                  <Button type="submit" variant="secondary">
                    Reject
                  </Button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await updateApprovalAction(a.id, "approved");
                  }}
                >
                  <Button type="submit">Approve &amp; run</Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
