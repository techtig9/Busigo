import { test } from "node:test";
import assert from "node:assert/strict";
import { transformDataStep } from "../lib/engine/steps/transform-data";
import type { RunContext } from "../lib/engine/types";
import type { StepDefinition } from "../types/database";

function run(config: Record<string, any>, data: Record<string, any>) {
  const step: StepDefinition = { key: "step1", type: "transform_data", config };
  const ctx: RunContext = { data };
  return transformDataStep({ step, ctx, runId: "r", workflowId: "w", workspaceId: "ws", userId: "u" });
}

test("extract_field: pulls a nested value out by dotted path", async () => {
  const result = await run({ operation: "extract_field", path: "trigger.customer.id" }, { trigger: { customer: { id: "abc123" } } });
  assert.equal(result.status, "success");
  assert.equal(result.output, "abc123");
});

test("extract_field: missing path resolves to null, not an error", async () => {
  const result = await run({ operation: "extract_field", path: "trigger.missing.deeply" }, { trigger: {} });
  assert.equal(result.status, "success");
  assert.equal(result.output, null);
});

test("json_parse: parses a merge-field-resolved JSON string", async () => {
  const result = await run({ operation: "json_parse", text: "{{trigger.raw}}" }, { trigger: { raw: '{"a":1,"b":[1,2,3]}' } });
  assert.equal(result.status, "success");
  assert.deepEqual(result.output, { a: 1, b: [1, 2, 3] });
});

test("json_parse: invalid JSON fails cleanly instead of throwing uncaught", async () => {
  const result = await run({ operation: "json_parse", text: "not json" }, {});
  assert.equal(result.status, "failed");
  assert.ok(result.error);
});

test("json_stringify: turns an object back into a JSON string", async () => {
  const result = await run({ operation: "json_stringify", path: "trigger.obj" }, { trigger: { obj: { x: 1 } } });
  assert.equal(result.status, "success");
  assert.equal(result.output, '{"x":1}');
});

test("uppercase / lowercase / trim operate on merge-field-resolved text", async () => {
  assert.equal((await run({ operation: "uppercase", text: "{{trigger.s}}" }, { trigger: { s: "hi" } })).output, "HI");
  assert.equal((await run({ operation: "lowercase", text: "{{trigger.s}}" }, { trigger: { s: "HI" } })).output, "hi");
  assert.equal((await run({ operation: "trim", text: "  padded  " }, {})).output, "padded");
});

test("unknown operation fails with a clear error rather than silently no-op'ing", async () => {
  const result = await run({ operation: "not_a_real_operation" }, {});
  assert.equal(result.status, "failed");
  assert.match(result.error!, /Unknown transform operation/);
});
