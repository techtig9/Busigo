import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { roleAtLeast } from "@/lib/workspace/roles";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { listDeadLettersAction } from "@/lib/actions/reliability";
import { DeadLetterList } from "./DeadLetterList";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RunsOverviewPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace, role } = await getWorkspaceContext();

  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, name, status")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  const { data: recentRuns } = await supabase
    .from("workflow_runs")
    .select("id, status, started_at, workflow_id, workflows!inner(name, workspace_id)")
    .eq("workflows.workspace_id", workspace.id)
    .order("started_at", { ascending: false })
    .limit(20);

  const deadLetters = await listDeadLettersAction();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-ink">Runs</h1>

      <Card>
        <h2 className="mb-3 font-bold text-ink">By workflow</h2>
        {!workflows || workflows.length === 0 ? (
          <p className="text-sm text-slate">No workflows yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {workflows.map((wf) => (
              <li key={wf.id} className="flex items-center justify-between py-2.5">
                <Link href={`/runs/${wf.id}`} className="text-sm font-semibold text-ink hover:text-signal">
                  {wf.name}
                </Link>
                <Badge tone={wf.status === "published" ? "signal" : "slate"}>{wf.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-bold text-ink">Recent activity, all workflows</h2>
        {!recentRuns || recentRuns.length === 0 ? (
          <p className="text-sm text-slate">No runs yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {recentRuns.map((run: any) => (
              <li key={run.id} className="flex items-center justify-between py-2.5 text-sm">
                <Link href={`/runs/${run.workflow_id}/${run.id}`} className="text-ink hover:text-signal">
                  {run.workflows?.name} <span className="text-xs text-slate">— {formatDate(run.started_at)}</span>
                </Link>
                <Badge tone={statusTone(run.status)}>{run.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-bold text-ink">Dead-lettered steps</h2>
        <p className="mb-3 text-xs text-slate">
          A run whose step failed repeatedly (network errors, 5xx, or 429 responses) retries automatically with backoff up
          to 3 times before landing here. Manager role or above can replay one once the underlying issue is fixed.
        </p>
        <DeadLetterList entries={deadLetters as any} canReplay={roleAtLeast(role, "manager")} />
      </Card>
    </div>
  );
}
