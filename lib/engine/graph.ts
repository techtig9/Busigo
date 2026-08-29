// No "server-only" import — pure, deterministic graph logic used by both the executor
// (server) and the canvas UI (client), and directly unit-tested in test/graph.test.ts.
import type { StepDefinition } from "@/types/database";

export interface GraphNode {
  key: string;
  type: StepDefinition["type"];
  config: Record<string, any>;
  /** Canvas position — cosmetic only, never read by the executor. */
  position: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** Set only on an edge leaving a `filter` node: which branch it represents.
   * Undefined on every other edge (a node with a single, unconditional next step). */
  branch?: "true" | "false";
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** A workflow's `definition` column holds either the legacy linear array or a graph — this covers both without guessing from shape alone. */
export type WorkflowDefinition = StepDefinition[] | WorkflowGraph;

export function isGraphFormat(definition: WorkflowDefinition | null | undefined): definition is WorkflowGraph {
  return !!definition && !Array.isArray(definition) && Array.isArray((definition as WorkflowGraph).nodes);
}

const LAYOUT_X = 260;
const LAYOUT_Y_START = 40;
const LAYOUT_Y_STEP = 140;

/**
 * Converts a legacy linear StepDefinition[] into an equivalent graph — a straight chain,
 * each step's only edge pointing at the next one, laid out top-to-bottom. A `filter` step in
 * the old format always stopped the run on a non-pass (see lib/engine/steps/filter.ts) — that
 * behavior is preserved exactly: no "false" edge is created, so the graph traversal has
 * nowhere to go on a failed filter, same as the old index-based executor stopping there.
 * Every already-published workflow keeps working unchanged; this only matters for how the
 * canvas displays it and how a NEW "false" edge can be added on top going forward.
 */
export function linearToGraph(steps: StepDefinition[]): WorkflowGraph {
  const nodes: GraphNode[] = steps.map((step, i) => ({
    key: step.key,
    type: step.type,
    config: step.config,
    position: { x: LAYOUT_X, y: LAYOUT_Y_START + i * LAYOUT_Y_STEP },
  }));

  const edges: GraphEdge[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    edges.push({ id: `${steps[i].key}->${steps[i + 1].key}`, source: steps[i].key, target: steps[i + 1].key });
  }

  return { nodes, edges };
}

/** Normalizes either stored format into a graph — the one shape the executor and canvas actually work with. */
export function normalizeToGraph(definition: WorkflowDefinition | null | undefined): WorkflowGraph {
  if (!definition) return { nodes: [], edges: [] };
  return isGraphFormat(definition) ? definition : linearToGraph(definition);
}

/** The node with no incoming edges — where a run starts. Ambiguous (or absent) for a malformed graph; callers should validate separately (see validateGraph) before relying on this for execution. */
export function findEntryNode(graph: WorkflowGraph): GraphNode | null {
  if (graph.nodes.length === 0) return null;
  const targets = new Set(graph.edges.map((e) => e.target));
  return graph.nodes.find((n) => !targets.has(n.key)) ?? graph.nodes[0];
}

/**
 * Which node(s) to follow from `fromKey`. For a non-filter node this is at most one (a
 * single unconditional edge — the model doesn't support fan-out for other step types, only
 * a filter's two-way branch). For a filter node, `branchTaken` selects which of the (up to
 * two) outgoing edges to follow; a branch with no edge simply ends the run there, exactly
 * like the old "stopped_by_filter halts everything" behavior when no "false" edge exists.
 */
export function nextNodeKey(graph: WorkflowGraph, fromKey: string, branchTaken?: "true" | "false"): string | null {
  const outgoing = graph.edges.filter((e) => e.source === fromKey);
  if (outgoing.length === 0) return null;
  if (branchTaken) {
    return outgoing.find((e) => e.branch === branchTaken)?.target ?? null;
  }
  return outgoing[0]?.target ?? null;
}

/**
 * Resolves the next node after a `filter` step specifically — the one node type that
 * branches. Two edge shapes are possible on a filter node's outgoing side:
 *  - explicitly labeled true/false edges (created in the canvas going forward), or
 *  - a single unlabeled edge (from linearToGraph, converting an already-published
 *    pre-Phase-4 workflow) — under the OLD linear semantics that edge only ever meant
 *    "what runs if the filter passes"; a fail always stopped the run outright. Preserving
 *    that exactly: an unlabeled edge is only followed when the filter passed, never on fail.
 * A branch with nothing wired to it (including "false" with no edge, the common case for
 * every filter that predates this phase) simply ends the run there — same as before.
 */
export function resolveFilterNext(graph: WorkflowGraph, fromKey: string, passed: boolean): string | null {
  const outgoing = graph.edges.filter((e) => e.source === fromKey);
  if (passed) {
    return outgoing.find((e) => e.branch === "true")?.target ?? outgoing.find((e) => !e.branch)?.target ?? null;
  }
  return outgoing.find((e) => e.branch === "false")?.target ?? null;
}

export function getNode(graph: WorkflowGraph, key: string): GraphNode | null {
  return graph.nodes.find((n) => n.key === key) ?? null;
}

/**
 * Every node with a path TO `key` — used by the canvas to offer only steps that could
 * actually have already run as merge-field references (`{{stepKey.field}}`) for a given
 * node, rather than every node in the workflow regardless of position or branch.
 */
export function getAncestorKeys(graph: WorkflowGraph, key: string): string[] {
  const incomingBySource = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = incomingBySource.get(edge.target) ?? [];
    list.push(edge.source);
    incomingBySource.set(edge.target, list);
  }

  const ancestors = new Set<string>();
  const queue = [...(incomingBySource.get(key) ?? [])];
  while (queue.length) {
    const current = queue.shift()!;
    if (ancestors.has(current)) continue;
    ancestors.add(current);
    queue.push(...(incomingBySource.get(current) ?? []));
  }
  return Array.from(ancestors);
}

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Structural checks before a graph can be saved/published — catches editor mistakes (a
 * dangling edge, a cycle, more than one entry point) that would otherwise surface as a
 * confusing runtime failure mid-execution instead of an editor-time error message.
 */
export function validateGraph(graph: WorkflowGraph): GraphValidationResult {
  const errors: string[] = [];
  const keys = new Set(graph.nodes.map((n) => n.key));

  for (const edge of graph.edges) {
    if (!keys.has(edge.source)) errors.push(`Edge references a missing source step "${edge.source}".`);
    if (!keys.has(edge.target)) errors.push(`Edge references a missing target step "${edge.target}".`);
  }

  const nonFilterOutDegree = new Map<string, number>();
  for (const edge of graph.edges) {
    const node = getNode(graph, edge.source);
    if (node && node.type !== "filter") {
      nonFilterOutDegree.set(edge.source, (nonFilterOutDegree.get(edge.source) ?? 0) + 1);
    }
  }
  for (const [key, count] of nonFilterOutDegree) {
    if (count > 1) errors.push(`Step "${key}" has more than one outgoing connection — only a Filter step can branch.`);
  }

  const filterBranches = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    const node = getNode(graph, edge.source);
    if (node?.type === "filter" && edge.branch) {
      const seen = filterBranches.get(edge.source) ?? new Set();
      if (seen.has(edge.branch)) errors.push(`Step "${edge.source}" has two "${edge.branch}" branches — only one of each is allowed.`);
      seen.add(edge.branch);
      filterBranches.set(edge.source, seen);
    } else if (node?.type === "filter" && !edge.branch) {
      errors.push(`Step "${edge.source}" is a Filter step — its outgoing connections must be labeled true or false.`);
    }
  }

  const entryPoints = graph.nodes.filter((n) => !graph.edges.some((e) => e.target === n.key));
  if (graph.nodes.length > 0 && entryPoints.length === 0) errors.push("Every step has an incoming connection — there's no starting point (a cycle back to the beginning).");
  if (entryPoints.length > 1) errors.push(`Multiple steps have no incoming connection (${entryPoints.map((n) => n.key).join(", ")}) — a workflow can only have one starting step.`);

  if (hasCycle(graph)) errors.push("This workflow's connections form a loop — a run would never finish.");

  return { valid: errors.length === 0, errors };
}

function hasCycle(graph: WorkflowGraph): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(key: string): boolean {
    if (visited.has(key)) return false;
    if (visiting.has(key)) return true;
    visiting.add(key);
    for (const edge of graph.edges.filter((e) => e.source === key)) {
      if (visit(edge.target)) return true;
    }
    visiting.delete(key);
    visited.add(key);
    return false;
  }

  return graph.nodes.some((n) => visit(n.key));
}
