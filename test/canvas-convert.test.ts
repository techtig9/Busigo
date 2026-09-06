import { test } from "node:test";
import assert from "node:assert/strict";
import { graphToFlow, flowToGraph } from "../lib/engine/canvas-convert";
import type { WorkflowGraph } from "../lib/engine/graph";

test("graphToFlow: maps nodes and a plain edge", () => {
  const graph: WorkflowGraph = {
    nodes: [
      { key: "a", type: "http_request", config: { url: "https://example.com" }, position: { x: 0, y: 0 } },
      { key: "b", type: "send_email", config: {}, position: { x: 0, y: 140 } },
    ],
    edges: [{ id: "a->b", source: "a", target: "b" }],
  };
  const { nodes, edges } = graphToFlow(graph);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].id, "a");
  assert.equal(nodes[0].data.stepType, "http_request");
  assert.deepEqual(nodes[0].data.config, { url: "https://example.com" });
  assert.equal(edges.length, 1);
  assert.equal(edges[0].sourceHandle, undefined);
});

test("graphToFlow: a branch edge carries its label through as sourceHandle and edge label", () => {
  const graph: WorkflowGraph = {
    nodes: [
      { key: "f", type: "filter", config: {}, position: { x: 0, y: 0 } },
      { key: "yes", type: "send_email", config: {}, position: { x: 0, y: 140 } },
    ],
    edges: [{ id: "1", source: "f", target: "yes", branch: "true" }],
  };
  const { edges } = graphToFlow(graph);
  assert.equal(edges[0].sourceHandle, "true");
  assert.equal(edges[0].label, "true");
});

test("flowToGraph: round-trips back to an equivalent graph", () => {
  const original: WorkflowGraph = {
    nodes: [
      { key: "f", type: "filter", config: { field: "trigger.x" }, position: { x: 10, y: 20 } },
      { key: "yes", type: "send_email", config: { to: "a@example.com" }, position: { x: 10, y: 160 } },
      { key: "no", type: "delay", config: { amount: 5 }, position: { x: 200, y: 160 } },
    ],
    edges: [
      { id: "1", source: "f", target: "yes", branch: "true" },
      { id: "2", source: "f", target: "no", branch: "false" },
    ],
  };
  const { nodes, edges } = graphToFlow(original);
  const roundTripped = flowToGraph(nodes, edges);
  assert.deepEqual(roundTripped, original);
});

test("flowToGraph: an edge's sourceHandle that isn't 'true' or 'false' is dropped, not misread as a branch", () => {
  const nodes = [{ id: "a", type: "step", position: { x: 0, y: 0 }, data: { stepType: "http_request" as const, config: {} } }];
  const edges = [{ id: "1", source: "a", target: "b", sourceHandle: "some-other-handle" }];
  const graph = flowToGraph(nodes as any, edges as any);
  assert.equal(graph.edges[0].branch, undefined);
});

test("graphToFlow: a node with no position gets a fallback rather than producing undefined", () => {
  // React Flow dereferences position.x without guarding, so an undefined position throws
  // inside its store and takes the entire builder page down via the error boundary — a
  // whole-page outage caused by a purely cosmetic field. Stored graphs always carry a
  // position (flowToGraph writes it), but a seeded template or an AI-generated plan need not.
  const graph = {
    nodes: [
      { key: "a", type: "http_request" as const, config: {} },
      { key: "b", type: "delay" as const, config: {}, position: { x: 99, y: 99 } },
    ],
    edges: [],
  };
  const { nodes } = graphToFlow(graph as any);
  assert.ok(nodes[0].position, "a node without a stored position must still get one");
  assert.equal(typeof nodes[0].position.x, "number");
  assert.equal(typeof nodes[0].position.y, "number");
  // An explicit position is never overwritten by the fallback.
  assert.deepEqual(nodes[1].position, { x: 99, y: 99 });
});
