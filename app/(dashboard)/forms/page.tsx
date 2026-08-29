import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();

  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, name, status, forms(slug, fields)")
    .eq("workspace_id", workspace.id)
    .eq("trigger_type", "form");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-ink">Forms</h1>
      <Card>
        {!workflows || workflows.length === 0 ? (
          <p className="text-sm text-slate">
            No form-triggered workflows yet.{" "}
            <Link href="/workflows/new" className="text-signal hover:underline">
              Create one
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {workflows.map((wf: any) => {
              const form = Array.isArray(wf.forms) ? wf.forms[0] : wf.forms;
              return (
                <li key={wf.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <Link href={`/workflows/${wf.id}`} className="text-sm font-semibold text-ink hover:text-signal">
                      {wf.name}
                    </Link>
                    <Badge tone={wf.status === "published" ? "signal" : "slate"}>{wf.status}</Badge>
                  </div>
                  {form?.slug ? (
                    <p className="mt-1 font-mono text-xs text-slate">/form/{form.slug}</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate">No form fields configured yet.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
