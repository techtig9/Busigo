"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Undo2,
  Redo2,
  Play,
  History,
  Trash2,
  MoreHorizontal,
  Check,
  Loader2,
  PanelBottomClose,
  PanelBottomOpen,
  Copy,
  ClipboardPaste,
  LayoutGrid,
  Smartphone,
} from "lucide-react";
import type { StepDefinition, TriggerType, FormField, StepType } from "@/types/database";
import { WorkflowCanvas, type WorkflowCanvasHandle } from "@/components/workflow-builder/canvas/WorkflowCanvas";
import { TestRunPanel } from "@/components/workflow-builder/TestRunPanel";
import { VersionHistory } from "@/components/workflow-builder/VersionHistory";
import { WebhookTrigger, ScheduleTrigger, FormTrigger } from "@/components/workflow-builder/TriggerSettings";
import type { LiveStatus } from "@/components/workflow-builder/StepCard";
import { normalizeToGraph, type WorkflowDefinition, type WorkflowGraph } from "@/lib/engine/graph";
import { STEP_LABELS, STEP_TYPES } from "@/lib/engine/types";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Menu, MenuItem, MenuSeparator, Tooltip, TooltipProvider } from "@/components/ui/Menu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Modal";
import { SignalPulse } from "@/components/patterns/Signals";
import { cn } from "@/lib/utils";
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

const AUTOSAVE_MS = 1500;
const HISTORY_LIMIT = 50;

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function WorkflowBuilder({ workflow, versions, form, aiActionAllowed }: Props) {
  const [definition, setDefinition] = useState<WorkflowDefinition>(workflow.definition || []);
  const [cron, setCron] = useState<string>(workflow.trigger_config?.cron || "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, setLiveStatuses] = useState<Record<string, { status: LiveStatus; output?: any }>>({});
  const [pending, startTransition] = useTransition();

  const [consoleOpen, setConsoleOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canvasRef = useRef<WorkflowCanvasHandle>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Undo/redo history.
   *
   * `past`/`future` hold whole definitions rather than diffs — a workflow graph is small, and
   * storing snapshots means an undo can never half-apply. `resetKey` is what pushes a restored
   * snapshot back into the canvas, which owns its own node state once mounted.
   */
  const [past, setPast] = useState<WorkflowDefinition[]>([]);
  const [future, setFuture] = useState<WorkflowDefinition[]>([]);
  const [resetKey, setResetKey] = useState(0);
  // Set while restoring, so the resulting onChange from the canvas isn't recorded as a new
  // history entry — otherwise undo would immediately push its own result back onto the stack.
  const restoring = useRef(false);

  const graph = normalizeToGraph(definition);
  const flatStepsForTestPanel: StepDefinition[] = graph.nodes.map((n) => ({
    key: n.key,
    type: n.type,
    config: n.config,
  }));

  const persist = useCallback(
    (next: WorkflowDefinition, nextCron: string) =>
      startTransition(async () => {
        try {
          setSaveState("saving");
          setSaveError(null);
          await saveDefinitionAction(workflow.id, next);
          if (workflow.trigger_type === "schedule") {
            await updateTriggerConfigAction(workflow.id, { cron: nextCron });
          }
          setSaveState("saved");
        } catch (e: any) {
          setSaveError(e.message);
          setSaveState("error");
        }
      }),
    [workflow.id, workflow.trigger_type]
  );

  // Autosave (spec §12). Debounced so a drag doesn't fire a write per frame; the explicit
  // Save action in the More menu remains for anyone who wants to force it.
  useEffect(() => {
    if (saveState !== "dirty") return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => persist(definition, cron), AUTOSAVE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [saveState, definition, cron, persist]);

  const handleGraphChange = (next: WorkflowGraph) => {
    if (restoring.current) {
      restoring.current = false;
      setDefinition(next);
      return;
    }
    setPast((p) => [...p.slice(-HISTORY_LIMIT), definition]);
    setFuture([]);
    setDefinition(next);
    setSaveState("dirty");
  };

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setFuture((f) => [definition, ...f]);
      restoring.current = true;
      setDefinition(previous);
      setResetKey((k) => k + 1);
      setSaveState("dirty");
      return p.slice(0, -1);
    });
  }, [definition]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, definition]);
      restoring.current = true;
      setDefinition(next);
      setResetKey((k) => k + 1);
      setSaveState("dirty");
      return f.slice(1);
    });
  }, [definition]);

  // Keyboard shortcuts (spec §12). Ignored while focus is in a field, so typing "z" in a
  // node's config box doesn't undo the graph.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        persist(definition, cron);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo, redo, persist, definition, cron]);

  // Warn before leaving with changes that haven't been written yet.
  useEffect(() => {
    if (saveState !== "dirty" && saveState !== "saving") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  const publish = () =>
    startTransition(async () => {
      try {
        setSaveError(null);
        await saveDefinitionAction(workflow.id, definition);
        if (workflow.trigger_type === "schedule") {
          await updateTriggerConfigAction(workflow.id, { cron });
        }
        await publishWorkflowAction(workflow.id);
        setSaveState("saved");
      } catch (e: any) {
        setSaveError(e.message);
        setSaveState("error");
      }
    });

  const availableTypes = STEP_TYPES.filter((t) =>
    workflow.trigger_type === "webhook" ? true : t !== "webhook_response"
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-panel px-4 py-2.5">
          <Link
            href="/workflows"
            className="flex items-center gap-1 rounded px-1.5 py-1 text-sm text-slate transition-colors duration-hover hover:bg-surface hover:text-ink"
          >
            <ChevronLeft size={15} aria-hidden />
            <span className="hidden sm:inline">Workflows</span>
          </Link>

          <div className="mx-1 h-5 w-px shrink-0 bg-hairline" aria-hidden />

          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-bold text-ink">{workflow.name}</h1>
            <Badge tone={workflow.status === "published" ? "success" : "slate"}>{workflow.status}</Badge>
          </div>

          <SaveIndicator state={saveState} />

          <div className="ml-auto flex items-center gap-1.5">
            <Tooltip content="Undo (⌘Z)">
              <IconButton label="Undo" size="sm" onClick={undo} disabled={past.length === 0}>
                <Undo2 size={15} />
              </IconButton>
            </Tooltip>
            <Tooltip content="Redo (⇧⌘Z)">
              <IconButton label="Redo" size="sm" onClick={redo} disabled={future.length === 0}>
                <Redo2 size={15} />
              </IconButton>
            </Tooltip>

            <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-hairline sm:block" aria-hidden />

            <Tooltip content="Copy selected (⌘C)">
              <IconButton
                label="Copy selected nodes"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => canvasRef.current?.copySelection()}
              >
                <Copy size={15} />
              </IconButton>
            </Tooltip>
            <Tooltip content="Paste (⌘V)">
              <IconButton
                label="Paste nodes"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => canvasRef.current?.pasteClipboard()}
              >
                <ClipboardPaste size={15} />
              </IconButton>
            </Tooltip>
            <Tooltip content="Tidy layout">
              <IconButton
                label="Auto-layout the graph"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => canvasRef.current?.autoLayout()}
              >
                <LayoutGrid size={15} />
              </IconButton>
            </Tooltip>

            <Button size="sm" variant="secondary" onClick={() => setConsoleOpen((v) => !v)}>
              {consoleOpen ? <PanelBottomClose size={14} /> : <PanelBottomOpen size={14} />}
              <span className="hidden sm:inline">Test</span>
            </Button>

            {workflow.status === "published" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => startTransition(() => unpublishWorkflowAction(workflow.id))}
                disabled={pending}
              >
                Unpublish
              </Button>
            ) : (
              <Button size="sm" onClick={publish} loading={pending}>
                Publish
              </Button>
            )}

            <Menu
              align="end"
              trigger={
                <IconButton label="More actions" size="sm">
                  <MoreHorizontal size={16} />
                </IconButton>
              }
            >
              <MenuItem onSelect={() => persist(definition, cron)}>Save now (⌘S)</MenuItem>
              <MenuItem onSelect={() => setTriggerOpen(true)}>Trigger settings</MenuItem>
              <MenuItem onSelect={() => setVersionsOpen(true)}>Version history</MenuItem>
              <MenuSeparator />
              <MenuItem destructive onSelect={() => setConfirmDelete(true)}>
                Delete workflow
              </MenuItem>
            </Menu>
          </div>
        </div>

        {saveError && (
          <p role="alert" className="shrink-0 border-b border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger-ink">
            {saveError}
          </p>
        )}

        {pending && <SignalPulse active label="Saving workflow" className="shrink-0 rounded-none" />}

        {/* Body: node library · canvas (properties panel lives inside the canvas) */}
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-52 shrink-0 flex-col overflow-y-auto border-r border-hairline bg-panel md:flex">
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Node library</p>
            <div className="flex flex-col gap-0.5 px-2 pb-3">
              {availableTypes.map((type) => {
                const disabled = type === "ai_action" && !aiActionAllowed;
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={disabled}
                    onClick={() => canvasRef.current?.addStep(type as StepType)}
                    title={disabled ? "Requires the Starter plan or higher" : `Add ${STEP_LABELS[type]}`}
                    className={cn(
                      "flex items-center justify-between rounded px-2.5 py-2 text-left text-sm",
                      "transition-colors duration-hover",
                      disabled
                        ? "cursor-not-allowed text-muted"
                        : "text-ink hover:bg-surface"
                    )}
                  >
                    {STEP_LABELS[type]}
                    {disabled && <span className="text-[10px] font-semibold text-muted">Upgrade</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto border-t border-hairline p-3">
              <p className="text-[11px] leading-relaxed text-muted">
                Click a node to add it, then drag from a node&apos;s bottom handle to connect it. Shift-drag to select
                several, ⌘C / ⌘V to duplicate them, and ⌘Z to undo.
              </p>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {/* Editing a graph on a phone is genuinely poor: the properties inspector alone is
                320px. Rather than pretend otherwise, say so once above the canvas — the canvas
                itself stays fully pannable and inspectable, so viewing a workflow on a phone
                still works. */}
            <p className="flex items-center gap-2 border-b border-hairline bg-surface px-3 py-2 text-xs text-slate md:hidden">
              <Smartphone size={13} className="shrink-0" aria-hidden />
              You can pan and inspect here. Editing is much easier on a larger screen.
            </p>
            <WorkflowCanvas
              ref={canvasRef}
              definition={definition}
              onChange={handleGraphChange}
              triggerType={workflow.trigger_type}
              aiActionAllowed={aiActionAllowed}
              resetKey={resetKey}
            />
          </div>
        </div>

        {/* Bottom test console */}
        {consoleOpen && (
          <div className="max-h-72 shrink-0 overflow-y-auto border-t border-hairline bg-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Play size={14} className="text-signal" aria-hidden /> Test run
              </h2>
              <IconButton label="Close test console" size="sm" onClick={() => setConsoleOpen(false)}>
                <PanelBottomClose size={15} />
              </IconButton>
            </div>
            <p className="mb-3 text-xs text-muted">
              Runs against the saved definition. Changes autosave after a moment — the indicator above shows when.
            </p>
            <TestRunPanel workflowId={workflow.id} steps={flatStepsForTestPanel} onLiveUpdate={setLiveStatuses} />
          </div>
        )}
      </div>

      <Drawer open={triggerOpen} onOpenChange={setTriggerOpen} title={`Trigger — ${workflow.trigger_type}`} width="lg">
        {workflow.trigger_type === "webhook" && (
          <WebhookTrigger workflowId={workflow.id} token={workflow.trigger_token} />
        )}
        {workflow.trigger_type === "schedule" && (
          <ScheduleTrigger
            cron={cron}
            onChange={(v) => {
              setCron(v);
              setSaveState("dirty");
            }}
          />
        )}
        {workflow.trigger_type === "form" && (
          <FormTrigger workflowId={workflow.id} initialSlug={form?.slug || ""} initialFields={form?.fields || []} />
        )}
      </Drawer>

      <Drawer open={versionsOpen} onOpenChange={setVersionsOpen} title="Version history" width="lg">
        <VersionHistory workflowId={workflow.id} versions={versions} />
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Delete workflow?"
        body={`"${workflow.name}" and its run history will be removed. This cannot be undone.`}
        confirmLabel="Delete workflow"
        onConfirm={async () => {
          await deleteWorkflowAction(workflow.id);
        }}
      />
    </TooltipProvider>
  );
}

/** Autosave status. Text as well as an icon, so the state is never colour/shape only. */
function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    dirty: { icon: null, text: "Unsaved changes", cls: "text-muted" },
    saving: { icon: <Loader2 size={12} className="animate-spin" aria-hidden />, text: "Saving…", cls: "text-slate" },
    saved: { icon: <Check size={12} aria-hidden />, text: "Saved", cls: "text-success-ink" },
    error: { icon: null, text: "Not saved", cls: "text-danger-ink" },
  } as const;
  const m = map[state];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("ml-2 hidden items-center gap-1 text-xs font-medium sm:inline-flex", m.cls)}
    >
      {m.icon}
      {m.text}
    </span>
  );
}
