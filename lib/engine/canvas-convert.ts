// Pure, client-safe conversion — no "server-only" import (this runs in the browser, inside
// the canvas). Directly unit-tested in test/canvas-convert.test.ts.
import type { Node, Edge } from "@xyflow/react";
import type { WorkflowGraph, GraphNode, GraphEdge } from "@/lib/engine/graph";
import type { StepType } from "@/types/database";

export interface StepNodeData extends Record<string, unknown> {
  stepType: StepType;
  config: Record<string, any>;
}

export function graphToFlow(graph: WorkflowGraph): { nodes: Node<StepNodeData>[]; edges: Edge[] } {
  const nodes: Node<StepNodeData>[] = graph.nodes.map((n) => ({
    id: n.key,
    type: "step",
    position: n.position,
    data: { stepType: n.type, config: n.config },
  }));

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.branch, // undefined for a plain edge — React Flow treats that as the node's single default handle
    label: e.branch,
    animated: false,
  }));

  return { nodes, edges };
}

export function flowToGraph(nodes: Node<StepNodeData>[], edges: Edge[]): WorkflowGraph {
  const graphNodes: GraphNode[] = nodes.map((n) => ({
    key: n.id,
    type: n.data.stepType,
    config: n.data.config,
    position: n.position,
  }));

  const graphEdges: GraphEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    branch: e.sourceHandle === "true" || e.sourceHandle === "false" ? e.sourceHandle : undefined,
  }));

  return { nodes: graphNodes, edges: graphEdges };
}
