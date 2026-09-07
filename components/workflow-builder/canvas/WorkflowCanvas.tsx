"use client";

import { useCallback, useMemo, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useReactFlow,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { StepDefinition, StepType } from "@/types/database";
import { STEP_LABELS, STEP_TYPES } from "@/lib/engine/types";
import { normalizeToGraph, validateGraph, getAncestorKeys, type WorkflowDefinition, type WorkflowGraph } from "@/lib/engine/graph";
import { graphToFlow, flowToGraph, type StepNodeData } from "@/lib/engine/canvas-convert";
import { StepNode } from "./StepNode";
import { NodeConfigPanel } from "./NodeConfigPanel";
import type { AvailableRef } from "../MergeFieldPicker";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const NODE_TYPES = { step: StepNode };

const DEFAULT_CONFIG: Record<StepType, Record<string, any>> = {
  http_request: { method: "GET", url: "" },
  send_email: { to: "", subject: "", body: "" },
  delay: { amount: 5, unit: "minutes" },
  filter: { field: "trigger.", operator: "equals", value: "" },
  transform_data: { operation: "extract_field", path: "" },
  ai_action: { mode: "summarize", instruction: "", input: "" },
  webhook_response: { statusCode: 200, body: "{}" },
};

let keyCounter = 0;
function nextKey(existingKeys: string[]) {
  keyCounter += 1;
  let candidate = `step${existingKeys.length + keyCounter}`;
  while (existingKeys.includes(candidate)) {
    keyCounter += 1;
    candidate = `step${existingKeys.length + keyCounter}`;
  }
  return candidate;
}

interface Props {
  definition: WorkflowDefinition;
  onChange: (graph: WorkflowGraph) => void;
  triggerType: string;
  aiActionAllowed: boolean;
  /**
   * Bumped by the parent to force the canvas to re-seed from `definition`.
   *
   * The canvas owns its node/edge state once mounted, so undo/redo (which replaces the
   * definition wholesale from a history stack) would otherwise have no way to reach it.
   * Changing this counter is the parent saying "discard what you have and take this".
   */
  resetKey?: number;
  /** Live per-step status, keyed by step key, shown on the nodes during a test run. */
  liveStatuses?: Record<string, { status: string }>;
}

/** Imperative surface so the toolbar and node library outside the canvas can drive it. */
export interface WorkflowCanvasHandle {
  addStep: (type: StepType) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  autoLayout: () => void;
  hasClipboard: boolean;
}

const CanvasInner = forwardRef<WorkflowCanvasHandle, Props>(function CanvasInner(
  { definition, onChange, triggerType, aiActionAllowed, resetKey = 0, liveStatuses },
  ref
) {
  const initial = useMemo(() => graphToFlow(normalizeToGraph(definition)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StepNodeData>>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<{ nodes: Node<StepNodeData>[]; edges: Edge[] } | null>(null);
  const { fitView } = useReactFlow();

  // Re-seed from the definition when the parent signals a wholesale replacement. Guarded on
  // resetKey rather than on `definition` itself: `definition` changes on every keystroke as
  // the canvas reports its own edits upward, and reacting to that would fight the user.
  useEffect(() => {
    if (resetKey === 0) return;
    const next = graphToFlow(normalizeToGraph(definition));
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedId(null);
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every structural change (node/edge add/remove/reconnect, config edit) reports the graph
  // back up to WorkflowBuilder as the single source of truth it saves — the canvas doesn't
  // hold its own separate "dirty" state.
  const emitChange = useCallback(
    (nextNodes: Node<StepNodeData>[], nextEdges: Edge[]) => {
      const graph = flowToGraph(nextNodes, nextEdges);
      setValidationErrors(validateGraph(graph).errors);
      onChange(graph);
    },
    [onChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return; // no self-loops

      // A non-filter source (default handle, no sourceHandle) or a specific filter branch
      // handle can each carry at most one outgoing edge — connecting a new one replaces
      // whatever was already wired from that exact handle, rather than fanning out.
      const withoutReplaced = edges.filter((e) => !(e.source === connection.source && e.sourceHandle === connection.sourceHandle));
      const nextEdges = addEdge({ ...connection, label: connection.sourceHandle ?? undefined }, withoutReplaced);
      setEdges(nextEdges);
      emitChange(nodes, nextEdges);
    },
    [edges, nodes, setEdges, emitChange]
  );

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      const removed = changes.filter((c) => c.type === "remove").map((c: any) => c.id as string);
      if (removed.length) {
        const remainingNodes = nodes.filter((n) => !removed.includes(n.id));
        const remainingEdges = edges.filter((e) => !removed.includes(e.source) && !removed.includes(e.target));
        setEdges(remainingEdges);
        emitChange(remainingNodes, remainingEdges);
        if (removed.includes(selectedId ?? "")) setSelectedId(null);
      }
    },
    [onNodesChange, nodes, edges, setEdges, emitChange, selectedId]
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      if (changes.some((c) => c.type === "remove")) {
        // Defer to post-update state via a microtask-free re-derive: React Flow's own
        // reducer already applied the removal to `edges` by the time this line runs is not
        // guaranteed, so recompute from the change list directly instead of trusting `edges`.
        const removedIds = changes.filter((c) => c.type === "remove").map((c: any) => c.id as string);
        const remainingEdges = edges.filter((e) => !removedIds.includes(e.id));
        emitChange(nodes, remainingEdges);
      }
    },
    [onEdgesChange, nodes, edges, emitChange]
  );

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => setSelectedId(node.id), []);
  const onPaneClick = useCallback(() => setSelectedId(null), []);

  const addStep = useCallback((type: StepType) => {
    const key = nextKey(nodes.map((n) => n.id));
    const lowestY = nodes.reduce((max, n) => Math.max(max, n.position.y), 0);
    const newNode: Node<StepNodeData> = {
      id: key,
      type: "step",
      position: { x: 260, y: nodes.length === 0 ? 40 : lowestY + 160 },
      data: { stepType: type, config: { ...DEFAULT_CONFIG[type] } },
    };
    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    setShowPalette(false);
    setSelectedId(key);
    emitChange(nextNodes, edges);
  }, [nodes, edges, setNodes, emitChange]);

  const updateSelectedConfig = (config: Record<string, any>) => {
    if (!selectedId) return;
    const nextNodes = nodes.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, config } } : n));
    setNodes(nextNodes);
    emitChange(nextNodes, edges);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const nextNodes = nodes.filter((n) => n.id !== selectedId);
    const nextEdges = edges.filter((e) => e.source !== selectedId && e.target !== selectedId);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedId(null);
    emitChange(nextNodes, nextEdges);
  };

  /**
   * Copy / paste.
   *
   * Copies the SELECTED nodes plus only the edges whose two ends are both in the selection —
   * pasting an edge that points at a node you did not copy would produce a dangling
   * reference the executor cannot follow. Keys are regenerated and the internal edges are
   * remapped onto the new keys, so a pasted branch keeps its shape without colliding with the
   * originals.
   */
  const copySelection = useCallback(() => {
    const chosen = nodes.filter((n) => n.selected || n.id === selectedId);
    if (chosen.length === 0) return;
    const ids = new Set(chosen.map((n) => n.id));
    setClipboard({
      nodes: chosen.map((n) => ({ ...n })),
      edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e })),
    });
  }, [nodes, edges, selectedId]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;
    const existing = nodes.map((n) => n.id);
    const idMap = new Map<string, string>();
    const pastedNodes = clipboard.nodes.map((n, i) => {
      const key = nextKey([...existing, ...Array.from(idMap.values())]);
      idMap.set(n.id, key);
      return {
        ...n,
        id: key,
        selected: true,
        // Offset so the copy is visibly distinct from what it was copied from.
        position: { x: n.position.x + 40, y: n.position.y + 40 + i * 4 },
        data: { ...n.data, config: { ...n.data.config } },
      };
    });
    const pastedEdges = clipboard.edges.map((e) => ({
      ...e,
      id: `${idMap.get(e.source)}->${idMap.get(e.target)}-${Math.random().toString(36).slice(2, 7)}`,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
    }));
    const nextNodes = [...nodes.map((n) => ({ ...n, selected: false })), ...pastedNodes];
    const nextEdges = [...edges, ...pastedEdges];
    setNodes(nextNodes);
    setEdges(nextEdges);
    emitChange(nextNodes, nextEdges);
  }, [clipboard, nodes, edges, setNodes, setEdges, emitChange]);

  /**
   * Auto-layout.
   *
   * A breadth-first pass from the entry node: depth becomes the row, position within the
   * depth becomes the column. Deliberately simple rather than a full force-directed layout —
   * these graphs are small and mostly linear with occasional branches, and a predictable
   * top-to-bottom result is easier to read than an optimally-packed one. Nodes unreachable
   * from the entry (a fragment someone is still wiring up) are parked in a final row instead
   * of being dropped.
   */
  const autoLayout = useCallback(() => {
    const graph = flowToGraph(nodes, edges);
    const targets = new Set(graph.edges.map((e) => e.target));
    const roots = graph.nodes.filter((n) => !targets.has(n.key)).map((n) => n.key);
    const depth = new Map<string, number>();
    const queue: string[] = [...(roots.length ? roots : graph.nodes.slice(0, 1).map((n) => n.key))];
    queue.forEach((k) => depth.set(k, 0));

    while (queue.length) {
      const current = queue.shift()!;
      const d = depth.get(current) ?? 0;
      for (const e of graph.edges.filter((x) => x.source === current)) {
        if (depth.has(e.target)) continue;
        depth.set(e.target, d + 1);
        queue.push(e.target);
      }
    }

    const maxDepth = Math.max(0, ...Array.from(depth.values()));
    const perRow = new Map<number, string[]>();
    for (const n of graph.nodes) {
      const d = depth.get(n.key) ?? maxDepth + 1; // unreachable fragments go in a final row
      perRow.set(d, [...(perRow.get(d) ?? []), n.key]);
    }

    const COL = 300;
    const ROW = 150;
    const positions = new Map<string, { x: number; y: number }>();
    for (const [d, keys] of perRow) {
      keys.forEach((key, i) => {
        const offset = (i - (keys.length - 1) / 2) * COL;
        positions.set(key, { x: 260 + offset, y: 40 + d * ROW });
      });
    }

    const nextNodes = nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position }));
    setNodes(nextNodes);
    emitChange(nextNodes, edges);
    window.setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 0);
  }, [nodes, edges, setNodes, emitChange, fitView]);

  useImperativeHandle(ref, () => ({ addStep, copySelection, pasteClipboard, autoLayout, hasClipboard: !!clipboard }), [
    addStep,
    clipboard,
    copySelection,
    pasteClipboard,
    autoLayout,
  ]);

  // Canvas-scoped copy/paste shortcuts. Ignored while focus is in a field so copying text out
  // of a node's config box doesn't clone the node instead.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "c") copySelection();
      if (e.key.toLowerCase() === "v") pasteClipboard();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [copySelection, pasteClipboard]);

  const selectedNode = nodes.find((n) => n.id === selectedId);
  const availableRefs: AvailableRef[] = useMemo(() => {
    if (!selectedId) return [];
    const graph = flowToGraph(nodes, edges);
    const ancestorKeys = getAncestorKeys(graph, selectedId);
    const refs: AvailableRef[] = [{ key: "trigger", label: "Trigger data" }];
    for (const n of nodes) {
      if (ancestorKeys.includes(n.id)) refs.push({ key: n.id, label: STEP_LABELS[n.data.stepType] });
    }
    return refs;
  }, [selectedId, nodes, edges]);

  return (
    <div className="flex h-full min-h-[24rem] overflow-hidden border-y border-hairline">
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          deleteKeyCode={["Backspace", "Delete"]}
          multiSelectionKeyCode={["Meta", "Shift", "Control"]}
          selectionKeyCode="Shift"
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} className="!bg-canvas" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-panel" />
        </ReactFlow>

        <div className="absolute left-3 top-3 z-10 md:hidden">
          <button
            type="button"
            onClick={() => setShowPalette((v) => !v)}
            className="flex items-center gap-1.5 rounded border border-hairline bg-panel px-3 py-2 text-sm text-signal shadow-sm hover:border-signal"
          >
            <Plus size={15} /> Add step
          </button>
          {showPalette && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded border border-hairline bg-panel py-1 shadow-md">
              {STEP_TYPES.filter((t) => (triggerType === "webhook" ? true : t !== "webhook_response")).map((type) => {
                const disabled = type === "ai_action" && !aiActionAllowed;
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={disabled}
                    onClick={() => addStep(type)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                    title={disabled ? "Requires the Starter plan or higher" : undefined}
                  >
                    {STEP_LABELS[type]}
                    {disabled && <span className="text-xs text-slate">Upgrade</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {validationErrors.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 z-10 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger-ink">
            {validationErrors[0]}
          </div>
        )}

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded border border-dashed border-hairline bg-panel px-6 py-4 text-sm text-slate">
              No steps yet. Add your first step above.
            </p>
          </div>
        )}
      </div>

      {selectedNode && (
        <NodeConfigPanel
          step={{ key: selectedNode.id, type: selectedNode.data.stepType, config: selectedNode.data.config }}
          availableRefs={availableRefs}
          onChange={updateSelectedConfig}
          onDelete={deleteSelected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
});

export const WorkflowCanvas = forwardRef<WorkflowCanvasHandle, Props>(function WorkflowCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
