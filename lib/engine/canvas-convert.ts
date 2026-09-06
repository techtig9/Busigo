// Pure, client-safe conversion — no "server-only" import (this runs in the browser, inside
// the canvas). Directly unit-tested in test/canvas-convert.test.ts.
import type { Node, Edge } from "@xyflow/react";
import type { WorkflowGraph, GraphNode, GraphEdge } from "@/lib/engine/graph";
import type { StepType } from "@/types/database";

export interface StepNodeData extends Record<string, unknown> {
  stepType: StepType;
  config: Record<string, any>;
}

// Mirrors the fallback layout in lib/engine/graph.ts so a backfilled node lands where the
// linear converter would have put it.
const LAYOUT_X = 260;
const LAYOUT_Y_START = 40;
const LAYOUT_Y_STEP = 140;

export function graphToFlow(graph: WorkflowGraph): { nodes: Node<StepNodeData>[]; edges: Edge[] } {
  const nodes: Node<StepNodeData>[] = graph.nodes.map((n, i) => ({
    id: n.key,
    type: "step",
    // Position is cosmetic and only ever written by this file's flowToGraph, so stored graphs
    // normally have it. A graph from any other producer (a seeded template, an AI-generated
    // plan) may not — and React Flow dereferences position.x unguarded, so one missing value
    // throws inside its store and takes down the whole builder page rather than degrading.
    // Falling back to the linear layout keeps a slightly-wrong position from becoming an
    // outage.
    position: n.position ?? { x: LAYOUT_X, y: LAYOUT_Y_START + i * LAYOUT_Y_STEP },
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
