import { createServerSupabase } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/business-os";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { seedRecommendedAgentsAction, setAgentPolicyAction } from "@/lib/actions/business-os";
import { saveAgentPermissionsAction, createAgentTaskAction, handoffAgentTaskAction, completeAgentTaskAction } from "@/lib/actions/workforce";
import { BusinessPhaseBar } from "@/components/dashboard/BusinessPhaseBar";
import { AgentControls } from "@/components/workforce/AgentControls";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default async function WorkforcePage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const { agents } = await getBusinessContext(workspace.id);
  const [{ data: tasks }, { data: permissions }, { data: handoffs }, { data: actions }] = await Promise.all([
    supabase.from("agent_tasks").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("agent_permissions").select("*").eq("workspace_id", workspace.id),
    supabase.from("agent_handoffs").select("*").eq("workspace_id", workspace.id).eq("status", "open").order("created_at", { ascending: false }).limit(20),
    supabase.from("ai_actions").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const taskRows = tasks || [];
  const openTasks = taskRows.filter((t: any) => !["completed", "cancelled"].includes(t.status)).length;
  return <div className="mx-auto max-w-7xl space-y-6">
    <div><h1 className="text-2xl font-bold text-ink">AI Workforce Command Center</h1><p className="mt-1 text-sm text-slate">Deploy specialist AI workers with explicit permissions, tasks, memory boundaries, human handoffs and auditable actions.</p></div>
    <BusinessPhaseBar current={4}/>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card><p className="text-xs uppercase text-slate">Agents</p><p className="mt-2 text-2xl font-bold text-ink">{agents.length}</p></Card>
      <Card><p className="text-xs uppercase text-slate">Active</p><p className="mt-2 text-2xl font-bold text-ink">{agents.filter((a:any) => a.status === "active").length}</p></Card>
      <Card><p className="text-xs uppercase text-slate">Open tasks</p><p className="mt-2 text-2xl font-bold text-ink">{openTasks}</p></Card>
      <Card><p className="text-xs uppercase text-slate">Human handoffs</p><p className="mt-2 text-2xl font-bold text-ink">{(handoffs || []).length}</p></Card>
    </div>
    <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-ink">Recommended workforce</h2><p className="text-sm text-slate">All agents start with approval-required autonomy. Grant only the capabilities each role actually needs.</p></div><form action={seedRecommendedAgentsAction}><Button type="submit">Create / refresh agents</Button></form></div></Card>
    <div className="grid gap-4 lg:grid-cols-2">{agents.map((a: any) => {
      const agentPermissions = (permissions || []).filter((p: any) => p.agent_id === a.id);
      const agentTasks = taskRows.filter((t: any) => t.agent_id === a.id).slice(0, 5);
      return <Card key={a.id}>
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-ink">{a.name}</h3><p className="mt-1 text-xs uppercase tracking-wide text-slate">{a.agent_type}</p></div><Badge tone={a.status === "active" ? "pulse" : "warn"}>{a.status}</Badge></div>
        <p className="mt-3 text-sm text-slate">{a.description}</p>
        <div className="mt-4 flex flex-wrap gap-2"><Badge tone="neutral">Autonomy: {a.autonomy_level}</Badge><Badge tone="neutral">Permissions: {agentPermissions.filter((p:any)=>p.allowed).length}</Badge><Badge tone="neutral">Tasks: {agentTasks.length}</Badge></div>
        <AgentControls agent={a} permissions={agentPermissions} saveAction={saveAgentPermissionsAction} />
        <div className="mt-4 flex flex-wrap gap-2"><form action={async () => { "use server"; await setAgentPolicyAction(a.id, "approval_required", a.status === "active" ? "paused" : "active"); }}><Button type="submit" variant="secondary">{a.status === "active" ? "Pause" : "Activate safely"}</Button></form><form action={async () => { "use server"; await setAgentPolicyAction(a.id, "low_risk_auto", a.status); }}><Button type="submit" variant="ghost">Allow low-risk auto</Button></form></div>
        <form action={createAgentTaskAction} className="mt-4 grid gap-2 border-t border-hairline pt-4"><input type="hidden" name="agent_id" value={a.id}/><input name="title" required placeholder="Give this agent a task…" className="rounded border border-hairline bg-panel px-3 py-2 text-sm text-ink"/><textarea name="description" placeholder="Optional context or expected outcome" className="rounded border border-hairline bg-panel px-3 py-2 text-sm text-ink"/><Button type="submit">Queue task</Button></form>
      </Card>;
    })}</div>
    {handoffs && handoffs.length > 0 && <Card><h2 className="font-bold text-ink">Human handoffs</h2><div className="mt-3 space-y-3">{handoffs.map((h:any)=><div key={h.id} className="rounded border border-hairline p-3"><p className="text-sm text-ink">{h.reason}</p><p className="mt-1 text-xs text-slate">Waiting for human review</p></div>)}</div></Card>}
    <Card><h2 className="font-bold text-ink">Recent agent tasks</h2>{taskRows.length === 0 ? <p className="mt-3 text-sm text-slate">No tasks yet.</p> : <div className="mt-3 space-y-2">{taskRows.slice(0, 12).map((t:any)=><div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-hairline p-3"><div><p className="text-sm font-semibold text-ink">{t.title}</p><p className="text-xs text-slate">{t.status} · {t.priority}</p></div>{!["completed","cancelled"].includes(t.status) && <div className="flex gap-2"><form action={async()=>{ "use server"; await completeAgentTaskAction(t.id); }}><Button type="submit" variant="secondary">Complete</Button></form><form action={handoffAgentTaskAction}><input type="hidden" name="agent_id" value={t.agent_id}/><input type="hidden" name="task_id" value={t.id}/><input type="hidden" name="reason" value="Human review requested from workforce command center"/><Button type="submit" variant="ghost">Handoff</Button></form></div>}</div>)}</div>}</Card>
    <Card><h2 className="font-bold text-ink">Recent AI actions</h2>{(!actions || actions.length === 0) ? <p className="mt-3 text-sm text-slate">No agent actions recorded yet. Executions will appear here once agents are connected to live workflows.</p> : <div className="mt-3 space-y-2">{actions.map((x:any)=><div key={x.id} className="flex items-center justify-between rounded border border-hairline p-3"><span className="text-sm text-ink">{x.action_type}</span><Badge tone={x.status === "success" ? "pulse" : "warn"}>{x.status}</Badge></div>)}</div>}</Card>
  </div>;
}
