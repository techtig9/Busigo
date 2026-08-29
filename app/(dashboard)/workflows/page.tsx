import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { DuplicateButton } from "./DuplicateButton";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();

  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, name, description, trigger_type, status, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Workflows</h1>
        <Button href="/workflows/new">New workflow</Button>
      </div>

      {!workflows || workflows.length === 0 ? (
        <div className="rounded border border-dashed border-hairline p-12 text-center">
          <p className="text-sm text-slate">No workflows yet.</p>
          <Button href="/workflows/new" className="mt-4">
            Create your first workflow
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-hairline bg-panel">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-surface text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {workflows.map((wf) => (
                <tr key={wf.id}>
                  <td className="px-4 py-3">
                    <Link href={`/workflows/${wf.id}`} className="font-semibold text-ink hover:text-signal">
                      {wf.name}
                    </Link>
                    {wf.description && <p className="text-xs text-slate">{wf.description}</p>}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate">{wf.trigger_type}</td>
                  <td className="px-4 py-3">
                    <Badge tone={wf.status === "published" ? "signal" : "slate"}>{wf.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate">{formatDate(wf.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <DuplicateButton workflowId={wf.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
