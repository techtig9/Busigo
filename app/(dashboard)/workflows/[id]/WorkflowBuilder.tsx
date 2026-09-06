"use client";

import { useState, useTransition } from "react";
import type { StepDefinition, TriggerType, FormField } from "@/types/database";
import { WorkflowCanvas } from "@/components/workflow-builder/canvas/WorkflowCanvas";
import { TestRunPanel } from "@/components/workflow-builder/TestRunPanel";
import { VersionHistory } from "@/components/workflow-builder/VersionHistory";
import { WebhookTrigger, ScheduleTrigger, FormTrigger } from "@/components/workflow-builder/TriggerSettings";
import type { LiveStatus } from "@/components/workflow-builder/StepCard";
import { normalizeToGraph, type WorkflowDefinition, type WorkflowGraph } from "@/lib/engine/graph";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  saveDefinitionAction,
  publishWorkflowAction,
  unpublishWorkflowAction,
  deleteWorkflowAction,
  updateTriggerConfigAction,
} from "@/lib/actions/workflows";

interface Props {
  workflow: {
    id: string;
    name: string;
    description: string | null;
    trigger_type: TriggerType;
    trigger_token: string;
    trigger_config: Record<string, any>;
    definition: WorkflowDefinition;
    status: "draft" | "published";
  };
  versions: { id: string; created_at: string; definition: any[] }[];
  form: { slug: string; fields: FormField[] } | null;
  aiActionAllowed: boolean;
}

export function WorkflowBuilder({ workflow, versions, form, aiActionAllowed }: Props) {
  const [definition, setDefinition] = useState<WorkflowDefinition>(workflow.definition || []);
  const [cron, setCron] = useState<string>(workflow.trigger_config?.cron || "");
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, { status: LiveStatus; output?: any }>>({});
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"build" | "test" | "versions">("build");

  const graph = normalizeToGraph(definition);
  // TestRunPanel only needs step keys/types to seed its live-status display — the actual
  // test run reads the SAVED definition from the database, not this in-memory graph (see
  // app/api/workflows/[id]/test-run/route.ts), same as before the canvas.
  const flatStepsForTestPanel: StepDefinition[] = graph.nodes.map((n) => ({ key: n.key, type: n.type, config: n.config }));

  const handleGraphChange = (next: WorkflowGraph) => {
    setDefinition(next);
    setDirty(true);
  };

  const save = () =>
    startTransition(async () => {
      try {
        setSaveError(null);
        await saveDefinitionAction(workflow.id, definition);
        if (workflow.trigger_type === "schedule") {
          await updateTriggerConfigAction(workflow.id, { cron });
        }
        setDirty(false);
      } catch (e: any) {
        setSaveError(e.message);
      }
    });

  const publish = () =>
    startTransition(async () => {
      try {
        setSaveError(null);
        await saveDefinitionAction(workflow.id, definition);
        if (workflow.trigger_type === "schedule") {
          await updateTriggerConfigAction(workflow.id, { cron });
        }
        await publishWorkflowAction(workflow.id);
        setDirty(false);
      } catch (e: any) {
        setSaveError(e.message);
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink">{workflow.name}</h1>
            <Badge tone={workflow.status === "published" ? "signal" : "slate"}>{workflow.status}</Badge>
          </div>
          {workflow.description && <p className="mt-1 text-sm text-slate">{workflow.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={save} disabled={pending || !dirty}>
            {pending ? "Saving..." : "Save draft"}
          </Button>
          {workflow.status === "published" ? (
            <Button variant="ghost" onClick={() => startTransition(() => unpublishWorkflowAction(workflow.id))} disabled={pending}>
              Unpublish
            </Button>
          ) : (
            <Button onClick={publish} disabled={pending}>
              Publish
            </Button>
          )}
        </div>
      </div>

      {saveError && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{saveError}</p>}

      <Card>
        <h2 className="mb-3 font-bold text-ink">Trigger — {workflow.trigger_type}</h2>
        {workflow.trigger_type === "webhook" && <WebhookTrigger workflowId={workflow.id} token={workflow.trigger_token} />}
        {workflow.trigger_type === "schedule" && (
          <ScheduleTrigger
            cron={cron}
            onChange={(v) => {
              setCron(v);
              setDirty(true);
            }}
          />
        )}
        {workflow.trigger_type === "form" && (
          <FormTrigger workflowId={workflow.id} initialSlug={form?.slug || ""} initialFields={form?.fields || []} />
        )}
      </Card>

      <div className="flex gap-1 border-b border-hairline">
        {(["build", "test", "versions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize ${
              tab === t ? "border-b-2 border-signal text-signal" : "text-slate hover:text-ink"
            }`}
          >
            {t === "build" ? "Canvas" : t === "test" ? "Test run" : "Version history"}
          </button>
        ))}
      </div>

      {tab === "build" && (
        <WorkflowCanvas
          definition={definition}
          onChange={handleGraphChange}
          triggerType={workflow.trigger_type}
          aiActionAllowed={aiActionAllowed}
        />
      )}

      {tab === "test" && (
        <Card>
          <h2 className="mb-3 font-bold text-ink">Test run</h2>
          <p className="mb-3 text-xs text-slate">
            Runs against the currently saved definition. Save your draft first if you&apos;ve made changes.
          </p>
          <TestRunPanel workflowId={workflow.id} steps={flatStepsForTestPanel} onLiveUpdate={setLiveStatuses} />
        </Card>
      )}

      {tab === "versions" && (
        <Card>
          <h2 className="mb-3 font-bold text-ink">Version history</h2>
          <VersionHistory workflowId={workflow.id} versions={versions} />
        </Card>
      )}

      <div className="border-t border-hairline pt-4">
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete "${workflow.name}"? This can't be undone.`)) {
              startTransition(() => deleteWorkflowAction(workflow.id));
            }
          }}
          className="text-xs font-semibold text-danger hover:underline"
        >
          Delete workflow
        </button>
      </div>
    </div>
  );
}
