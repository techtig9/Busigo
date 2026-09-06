import Link from "next/link";
import { Workflow as WorkflowIcon } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { DataTable, type Column } from "@/components/patterns/DataTable";
import { DuplicateButton } from "./DuplicateButton";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  status: string;
  created_at: string;
}

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

  const rows = (workflows || []) as Row[];
  const published = rows.filter((w) => w.status === "published").length;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      cell: (w) => (
        <>
          <span className="block truncate">{w.name}</span>
          {w.description && <span className="block truncate text-xs font-normal text-muted">{w.description}</span>}
        </>
      ),
    },
    { key: "trigger", header: "Trigger", hideBelow: "sm", cell: (w) => <span className="capitalize">{w.trigger_type}</span> },
    {
      key: "status",
      header: "Status",
      cell: (w) => <Badge tone={w.status === "published" ? "success" : "slate"}>{w.status}</Badge>,
    },
    { key: "created", header: "Created", hideBelow: "md", cell: (w) => formatDate(w.created_at) },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (w) => <DuplicateButton workflowId={w.id} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Workflows"
        description={
          rows.length
            ? `${rows.length} total · ${published} published and accepting triggers.`
            : "A workflow turns a trigger into a traced sequence of steps."
        }
        actions={<Button href="/workflows/new">New workflow</Button>}
      />

      <DataTable
        caption="All workflows in this workspace"
        columns={columns}
        rows={rows}
        rowKey={(w) => w.id}
        rowHref={(w) => `/workflows/${w.id}`}
        empty={
          <div className="rounded-xl border border-hairline bg-panel">
            <EmptyState
              icon={WorkflowIcon}
              title="No workflows yet"
              body="A workflow starts with a trigger — a webhook, a schedule, or a public form — and runs an ordered sequence of steps. Every execution is traced."
              action={{ label: "Create your first workflow", href: "/workflows/new" }}
              aiAction={{ label: "Draft one with AI", href: "/automation-center" }}
            />
          </div>
        }
      />

      {rows.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Looking for execution history?{" "}
          <Link href="/runs" className="text-signal hover:underline">
            Open Runs
          </Link>
          .
        </p>
      )}
    </>
  );
}
