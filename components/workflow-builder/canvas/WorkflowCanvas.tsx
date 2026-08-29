"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
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
}

function CanvasInner({ definition, onChange, triggerType, aiActionAllowed }: Props) {
  const initial = useMemo(() => graphToFlow(normalizeToGraph(definition)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StepNodeData>>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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

  const addStep = (type: StepType) => {
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
  };

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
    <div className="flex h-[36rem] overflow-hidden rounded border border-hairline">
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
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} className="!bg-canvas" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-panel" />
        </ReactFlow>

        <div className="absolute left-3 top-3 z-10">
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
          <div className="absolute bottom-3 left-3 right-3 z-10 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
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
}

export function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
