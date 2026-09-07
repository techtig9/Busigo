"use client";

import { useState, useTransition } from "react";
import { Bot, Pause, Play, ListChecks } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Modal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input, Textarea, Label } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import { Progress } from "@/components/ui/Controls";
import { EvidenceChip } from "@/components/patterns/Signals";
import { AgentControls } from "./AgentControls";
import { formatDate } from "@/lib/utils";

export interface AgentRow {
  id: string;
  name: string;
  agent_type: string;
  description: string | null;
  status: string;
  autonomy_level: string;
  created_at?: string;
}

const STATUS_TONE: Record<string, "success" | "warn" | "slate" | "danger"> = {
  active: "success",
  paused: "warn",
  draft: "slate",
  error: "danger",
};

/**
 * Agent card plus its detail drawer.
 *
 * The drawer's tabs are Overview / Tasks / Permissions / Activity — the four the database
 * actually holds data for. The specification also lists Knowledge and Evaluations tabs; those
 * are deliberately absent rather than rendered empty, because a tab that can only ever say
 * "nothing here" is the placeholder UI the brief forbids. They belong with the schema that
 * would back them.
 */
export function AgentCard({
  agent,
  permissions,
  tasks,
  actions,
  setPolicyAction,
  savePermissionsAction,
  createTaskAction,
  completeTaskAction,
  handoffTaskAction,
}: {
  agent: AgentRow;
  permissions: any[];
  tasks: any[];
  actions: any[];
  setPolicyAction: (agentId: string, autonomy: "approval_required" | "low_risk_auto", status: "draft" | "active" | "paused" | "error") => Promise<void>;
  savePermissionsAction: (formData: FormData) => void;
  createTaskAction: (formData: FormData) => void;
  completeTaskAction: (taskId: string) => Promise<void>;
  handoffTaskAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const granted = permissions.filter((p) => p.allowed).length;
  const openTasks = tasks.filter((t) => !["completed", "cancelled"].includes(t.status));
  const doneTasks = tasks.filter((t) => t.status === "completed");
  const successRate = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : null;
  const lastAction = actions[0];
  const isActive = agent.status === "active";

  const toggle = () =>
    startTransition(async () => {
      await setPolicyAction(agent.id, "approval_required", isActive ? "paused" : "active");
    });

  return (
    <>
      <Card>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-signal-ink">
            <Bot size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{agent.name}</CardTitle>
              <Badge tone={STATUS_TONE[agent.status] ?? "slate"}>{agent.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-muted">{agent.agent_type}</p>
          </div>
        </div>

        {agent.description && <p className="mt-3 line-clamp-2 text-sm text-slate">{agent.description}</p>}

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-hairline pt-3 text-center">
          <div>
            <dt className="text-[11px] text-muted">Open tasks</dt>
            <dd className="tabular mt-0.5 text-lg font-bold text-ink">{openTasks.length}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">Completed</dt>
            <dd className="tabular mt-0.5 text-lg font-bold text-ink">{doneTasks.length}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">Permissions</dt>
            <dd className="tabular mt-0.5 text-lg font-bold text-ink">{granted}</dd>
          </div>
        </dl>

        {successRate !== null && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted">Task completion</span>
              <span className="tabular font-semibold text-slate">{successRate}%</span>
            </div>
            <Progress value={successRate} label={`${agent.name} task completion`} className="mt-1" />
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <EvidenceChip label={`Autonomy: ${agent.autonomy_level.replace(/_/g, " ")}`} />
          {lastAction && <EvidenceChip label={`Last action ${formatDate(lastAction.created_at).split(",")[0]}`} />}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-4">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Open agent
          </Button>
          <Button size="sm" variant="ghost" onClick={toggle} loading={pending}>
            {isActive ? <Pause size={14} /> : <Play size={14} />}
            {isActive ? "Pause" : "Activate"}
          </Button>
        </div>
      </Card>

      <Drawer open={open} onOpenChange={setOpen} title={agent.name} description={agent.agent_type} width="lg">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks" count={tasks.length}>
              Tasks
            </TabsTrigger>
            <TabsTrigger value="permissions" count={granted}>
              Permissions
            </TabsTrigger>
            <TabsTrigger value="activity" count={actions.length}>
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
              {agent.description && <p className="text-sm text-slate">{agent.description}</p>}
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-hairline p-3">
                  <dt className="text-xs text-muted">Status</dt>
                  <dd className="mt-1">
                    <Badge tone={STATUS_TONE[agent.status] ?? "slate"}>{agent.status}</Badge>
                  </dd>
                </div>
                <div className="rounded-lg border border-hairline p-3">
                  <dt className="text-xs text-muted">Autonomy</dt>
                  <dd className="mt-1 capitalize text-ink">{agent.autonomy_level.replace(/_/g, " ")}</dd>
                </div>
              </dl>
              <p className="rounded-lg border border-hairline bg-surface p-3 text-xs text-slate">
                An agent on <strong className="text-ink">approval required</strong> cannot take a high-impact action on
                its own — the action waits in the Approval Center with its evidence attached.
              </p>
              <form
                action={(fd) => {
                  fd.set("agent_id", agent.id);
                  createTaskAction(fd);
                }}
                className="space-y-2 border-t border-hairline pt-4"
              >
                <div>
                  <Label htmlFor={`task-title-${agent.id}`}>Queue a task</Label>
                  <Input id={`task-title-${agent.id}`} name="title" required placeholder="What should this agent do?" />
                </div>
                <Textarea name="description" placeholder="Optional context or expected outcome" />
                <Button type="submit" size="sm">
                  Queue task
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            {tasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No tasks yet"
                body="Queue one from the Overview tab and it will appear here with its status."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-hairline">
                {tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{t.title}</p>
                      <p className="text-xs text-muted">
                        {t.priority} priority · {formatDate(t.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={t.status} />
                      {!["completed", "cancelled"].includes(t.status) && (
                        <>
                          <form action={async () => completeTaskAction(t.id)}>
                            <Button type="submit" size="sm" variant="secondary">
                              Complete
                            </Button>
                          </form>
                          <form action={handoffTaskAction}>
                            <input type="hidden" name="agent_id" value={agent.id} />
                            <input type="hidden" name="task_id" value={t.id} />
                            <input type="hidden" name="reason" value="Human review requested from the agent detail panel" />
                            <Button type="submit" size="sm" variant="ghost">
                              Hand off
                            </Button>
                          </form>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="permissions">
            <p className="mb-3 text-sm text-slate">
              Grant only the capabilities this role actually needs. &ldquo;Approval&rdquo; means the agent may propose
              the action but a human decides.
            </p>
            <AgentControls agent={agent} permissions={permissions} saveAction={savePermissionsAction} startOpen />
          </TabsContent>

          <TabsContent value="activity">
            {actions.length === 0 ? (
              <EmptyState
                icon={Bot}
                title="No recorded actions"
                body="Every action this agent takes is recorded here with its outcome, once it is connected to a live workflow."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-hairline">
                {actions.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-ink">{x.action_type}</p>
                      <p className="text-xs text-muted">{formatDate(x.created_at)}</p>
                    </div>
                    <StatusBadge status={x.status} />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </Drawer>
    </>
  );
}
