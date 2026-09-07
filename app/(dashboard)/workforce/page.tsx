import { Bot, UserCheck } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/business-os";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { seedRecommendedAgentsAction, setAgentPolicyAction } from "@/lib/actions/business-os";
import {
  saveAgentPermissionsAction,
  createAgentTaskAction,
  handoffAgentTaskAction,
  completeAgentTaskAction,
} from "@/lib/actions/workforce";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { Metric, MetricStrip } from "@/components/patterns/Metric";
import { AiCallout } from "@/components/patterns/Signals";
import { AgentCard, type AgentRow } from "@/components/workforce/AgentCard";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WorkforcePage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const { agents } = await getBusinessContext(workspace.id);

  const [{ data: tasks }, { data: permissions }, { data: handoffs }, { data: actions }] = await Promise.all([
    supabase.from("agent_tasks").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(120),
    supabase.from("agent_permissions").select("*").eq("workspace_id", workspace.id),
    supabase.from("agent_handoffs").select("*").eq("workspace_id", workspace.id).eq("status", "open").order("created_at", { ascending: false }).limit(20),
    supabase.from("ai_actions").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(60),
  ]);

  const taskRows = tasks || [];
  const actionRows = actions || [];
  const handoffRows = handoffs || [];
  const openTasks = taskRows.filter((t: any) => !["completed", "cancelled"].includes(t.status)).length;
  const activeAgents = agents.filter((a: any) => a.status === "active").length;

  // Server actions are passed down as props so the cards can stay client components without
  // each one re-importing the action module.
  async function setPolicy(agentId: string, autonomy: "approval_required" | "low_risk_auto", status: "draft" | "active" | "paused" | "error") {
    "use server";
    await setAgentPolicyAction(agentId, autonomy, status);
  }
  async function completeTask(taskId: string) {
    "use server";
    await completeAgentTaskAction(taskId);
  }

  return (
    <>
      <PageHeader
        title="AI Workforce"
        description="Specialist agents with explicit permissions, queued tasks, human handoffs and an auditable record of every action."
        actions={
          <form action={seedRecommendedAgentsAction}>
            <Button type="submit" variant={agents.length ? "secondary" : "primary"}>
              {agents.length ? "Refresh recommended agents" : "Create recommended agents"}
            </Button>
          </form>
        }
      />

      {agents.length > 0 && (
        <MetricStrip className="mb-4 lg:grid-cols-4">
          <Metric label="Agents" value={agents.length} hint={`${activeAgents} active`} />
          <Metric label="Open tasks" value={openTasks} />
          <Metric label="Human handoffs" value={handoffRows.length} goodDirection="down" />
          <Metric label="Recorded actions" value={actionRows.length} hint="most recent 60" />
        </MetricStrip>
      )}

      {handoffRows.length > 0 && (
        <AiCallout className="mb-4" action={<Button size="sm" variant="secondary" href="/approvals">Review</Button>}>
          <span className="font-semibold">
            {handoffRows.length} {handoffRows.length === 1 ? "task needs" : "tasks need"} a human.
          </span>{" "}
          An agent stopped and asked rather than guessing.
        </AiCallout>
      )}

      {agents.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bot}
            title="No agents yet"
            body="BusiGo can create a recommended set of specialist agents — sales, support, operations and finance — all starting on approval-required autonomy so none of them can act without you."
            action={{ label: "Create recommended agents", href: "#" }}
          />
          <form action={seedRecommendedAgentsAction} className="flex justify-center pb-2">
            <Button type="submit">Create recommended agents</Button>
          </form>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {agents.map((a: any) => (
            <AgentCard
              key={a.id}
              agent={a as AgentRow}
              permissions={(permissions || []).filter((p: any) => p.agent_id === a.id)}
              tasks={taskRows.filter((t: any) => t.agent_id === a.id)}
              actions={actionRows.filter((x: any) => x.agent_id === a.id)}
              setPolicyAction={setPolicy}
              savePermissionsAction={saveAgentPermissionsAction}
              createTaskAction={createAgentTaskAction}
              completeTaskAction={completeTask}
              handoffTaskAction={handoffAgentTaskAction}
            />
          ))}
        </div>
      )}

      {handoffRows.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div>
              <CardTitle>Human handoffs</CardTitle>
              <CardDescription>Work an agent escalated rather than completing on its own.</CardDescription>
            </div>
          </CardHeader>
          <ul className="divide-y divide-hairline">
            {handoffRows.map((h: any) => (
              <li key={h.id} className="flex items-start gap-2.5 py-3">
                <UserCheck size={15} className="mt-0.5 shrink-0 text-warn-ink" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm text-ink">{h.reason}</p>
                  <p className="text-xs text-muted">Waiting for human review · {formatDate(h.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {actionRows.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div>
              <CardTitle>Recent agent actions</CardTitle>
              <CardDescription>Everything agents have actually done, most recent first.</CardDescription>
            </div>
          </CardHeader>
          <ul className="divide-y divide-hairline">
            {actionRows.slice(0, 12).map((x: any) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-ink">{x.action_type}</p>
                  <p className="text-xs text-muted">{formatDate(x.created_at)}</p>
                </div>
                <StatusBadge status={x.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
