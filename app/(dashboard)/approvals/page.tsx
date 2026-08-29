import { createServerSupabase } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/business-os";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { updateApprovalAction } from "@/lib/actions/business-os";
import { BusinessPhaseBar } from "@/components/dashboard/BusinessPhaseBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default async function ApprovalsPage() {
  const supabase = createServerSupabase(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const { approvals } = await getBusinessContext(workspace.id);
  return <div className="mx-auto max-w-5xl space-y-6"><div><h1 className="text-2xl font-bold text-ink">Approval Center</h1><p className="mt-1 text-sm text-slate">High-impact AI actions wait here until a human approves them.</p></div><BusinessPhaseBar current={4}/><div className="space-y-4">{approvals.length === 0 ? <Card><p className="text-sm text-slate">No pending approvals. That's good — agents cannot silently cross your configured approval boundary.</p></Card> : approvals.map((a: any) => <Card key={a.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="font-bold text-ink">{a.title}</h2><Badge tone={a.risk_level === "high" ? "danger" : "warn"}>{a.risk_level} risk</Badge></div><p className="mt-2 text-sm text-slate">{a.reason}</p><pre className="mt-3 max-h-48 overflow-auto rounded bg-surface p-3 text-xs text-ink">{JSON.stringify(a.payload || {}, null, 2)}</pre></div><div className="flex shrink-0 gap-2"><form action={async () => { "use server"; await updateApprovalAction(a.id, "rejected"); }}><Button type="submit" variant="danger">Reject</Button></form><form action={async () => { "use server"; await updateApprovalAction(a.id, "approved"); }}><Button type="submit">Approve</Button></form></div></div></Card>)}</div></div>;
}
