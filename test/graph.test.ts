import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linearToGraph,
  normalizeToGraph,
  isGraphFormat,
  findEntryNode,
  nextNodeKey,
  resolveFilterNext,
  validateGraph,
  getAncestorKeys,
  type WorkflowGraph,
} from "../lib/engine/graph";
import type { StepDefinition } from "../types/database";

const step = (key: string, type: StepDefinition["type"] = "http_request"): StepDefinition => ({ key, type, config: {} });

test("isGraphFormat: distinguishes the legacy array from a graph", () => {
  assert.equal(isGraphFormat([step("a")]), false);
  assert.equal(isGraphFormat({ nodes: [], edges: [] }), true);
  assert.equal(isGraphFormat(null), false);
  assert.equal(isGraphFormat(undefined), false);
});

test("linearToGraph: chains steps in order with one edge each", () => {
  const graph = linearToGraph([step("a"), step("b"), step("c")]);
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
  assert.deepEqual(graph.edges.map((e) => [e.source, e.target]), [["a", "b"], ["b", "c"]]);
});

test("linearToGraph: a single step has no edges", () => {
  const graph = linearToGraph([step("only")]);
  assert.equal(graph.edges.length, 0);
});

test("normalizeToGraph: passes an already-graph definition through unchanged", () => {
  const original: WorkflowGraph = { nodes: [{ key: "a", type: "http_request", config: {}, position: { x: 0, y: 0 } }], edges: [] };
  assert.equal(normalizeToGraph(original), original);
});

test("normalizeToGraph: converts a legacy array", () => {
  const graph = normalizeToGraph([step("a"), step("b")]);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
});

test("normalizeToGraph: null/undefined becomes an empty graph, not a crash", () => {
  assert.deepEqual(normalizeToGraph(null), { nodes: [], edges: [] });
  assert.deepEqual(normalizeToGraph(undefined), { nodes: [], edges: [] });
});

test("findEntryNode: the node with no incoming edge", () => {
  const graph = linearToGraph([step("a"), step("b"), step("c")]);
  assert.equal(findEntryNode(graph)?.key, "a");
});

test("findEntryNode: empty graph has no entry node", () => {
  assert.equal(findEntryNode({ nodes: [], edges: [] }), null);
});

test("nextNodeKey: follows a plain unconditional edge", () => {
  const graph = linearToGraph([step("a"), step("b")]);
  assert.equal(nextNodeKey(graph, "a"), "b");
});

test("nextNodeKey: a terminal node (no outgoing edge) returns null", () => {
  const graph = linearToGraph([step("a"), step("b")]);
  assert.equal(nextNodeKey(graph, "b"), null);
});

test("resolveFilterNext: follows the matching labeled branch", () => {
  const graph: WorkflowGraph = {
    nodes: [step("f", "filter"), step("yes"), step("no")].map((s, i) => ({ ...s, position: { x: 0, y: i } })),
    edges: [
      { id: "1", source: "f", target: "yes", branch: "true" },
      { id: "2", source: "f", target: "no", branch: "false" },
    ],
  };
  assert.equal(resolveFilterNext(graph, "f", true), "yes");
  assert.equal(resolveFilterNext(graph, "f", false), "no");
});

test("resolveFilterNext: a branch with no edge ends the run there — same as the old stopped_by_filter behavior", () => {
  const graph: WorkflowGraph = {
    nodes: [step("f", "filter"), step("yes")].map((s, i) => ({ ...s, position: { x: 0, y: i } })),
    edges: [{ id: "1", source: "f", target: "yes", branch: "true" }],
  };
  assert.equal(resolveFilterNext(graph, "f", false), null);
});

test("resolveFilterNext: a legacy single unlabeled edge (converted from a pre-Phase-4 workflow) is followed only when the filter passes", () => {
  // linearToGraph produces exactly this shape for a filter step: one plain edge, no branch label.
  const graph = linearToGraph([step("f", "filter"), step("next")]);
  assert.equal(resolveFilterNext(graph, "f", true), "next");
  assert.equal(resolveFilterNext(graph, "f", false), null);
});

test("validateGraph: an empty graph is valid", () => {
  assert.equal(validateGraph({ nodes: [], edges: [] }).valid, true);
});

test("validateGraph: a simple linear chain is valid", () => {
  const graph = linearToGraph([step("a"), step("b"), step("c")]);
  assert.equal(validateGraph(graph).valid, true);
});

test("validateGraph: a well-formed filter branch is valid", () => {
  const graph: WorkflowGraph = {
    nodes: [step("f", "filter"), step("yes"), step("no")].map((s, i) => ({ ...s, position: { x: 0, y: i } })),
    edges: [
      { id: "1", source: "f", target: "yes", branch: "true" },
      { id: "2", source: "f", target: "no", branch: "false" },
    ],
  };
  assert.equal(validateGraph(graph).valid, true);
});

test("validateGraph: rejects an edge pointing at a step that doesn't exist", () => {
  const graph: WorkflowGraph = { nodes: [{ key: "a", type: "http_request", config: {}, position: { x: 0, y: 0 } }], edges: [{ id: "1", source: "a", target: "ghost" }] };
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("ghost")));
});

test("validateGraph: rejects a non-filter step with two outgoing connections", () => {
  const graph: WorkflowGraph = {
    nodes: [step("a"), step("b"), step("c")].map((s, i) => ({ ...s, position: { x: 0, y: i } })),
    edges: [
      { id: "1", source: "a", target: "b" },
      { id: "2", source: "a", target: "c" },
    ],
  };
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("only a Filter step can branch")));
});

test("validateGraph: rejects a filter edge with no branch label", () => {
  const graph: WorkflowGraph = {
    nodes: [step("f", "filter"), step("next")].map((s, i) => ({ ...s, position: { x: 0, y: i } })),
    edges: [{ id: "1", source: "f", target: "next" }],
  };
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("must be labeled true or false")));
});

test("validateGraph: rejects a filter step with two true branches", () => {
  const graph: WorkflowGraph = {
    nodes: [step("f", "filter"), step("a"), step("b")].map((s, i) => ({ ...s, position: { x: 0, y: i } })),
    edges: [
      { id: "1", source: "f", target: "a", branch: "true" },
      { id: "2", source: "f", target: "b", branch: "true" },
    ],
  };
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("two \"true\" branches")));
});

test("validateGraph: rejects a cycle", () => {
  const graph: WorkflowGraph = {
    nodes: [step("a"), step("b")].map((s, i) => ({ ...s, position: { x: 0, y: i } })),
    edges: [
      { id: "1", source: "a", target: "b" },
      { id: "2", source: "b", target: "a" },
    ],
  };
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.toLowerCase().includes("loop")));
});

test("validateGraph: rejects more than one entry point", () => {
  const graph: WorkflowGraph = {
    nodes: [step("a"), step("b"), step("c")].map((s, i) => ({ ...s, position: { x: 0, y: i } })),
    edges: [{ id: "1", source: "a", target: "c" }], // b has no incoming edge either — two entry points (a, b)
  };
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("Multiple steps have no incoming connection")));
});

test("getAncestorKeys: collects every upstream node along a linear chain", () => {
  const graph = linearToGraph([step("a"), step("b"), step("c")]);
  assert.deepEqual(new Set(getAncestorKeys(graph, "c")), new Set(["a", "b"]));
  assert.deepEqual(getAncestorKeys(graph, "a"), []);
});

test("getAncestorKeys: only the taken branch's nodes are ancestors of a node past a fork", () => {
  const graph: WorkflowGraph = {
    nodes: [step("f", "filter"), step("yes"), step("afterYes"), step("no")].map((s, i) => ({ ...s, position: { x: 0, y: i } })),
    edges: [
      { id: "1", source: "f", target: "yes", branch: "true" },
      { id: "2", source: "f", target: "no", branch: "false" },
      { id: "3", source: "yes", target: "afterYes" },
    ],
  };
  assert.deepEqual(new Set(getAncestorKeys(graph, "afterYes")), new Set(["f", "yes"]));
  assert.ok(!getAncestorKeys(graph, "afterYes").includes("no"));
});
