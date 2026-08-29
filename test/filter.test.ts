import { test } from "node:test";
import assert from "node:assert/strict";
import { filterStep } from "../lib/engine/steps/filter";
import type { RunContext } from "../lib/engine/types";
import type { StepDefinition } from "../types/database";

function run(config: Record<string, any>, data: Record<string, any>) {
  const step: StepDefinition = { key: "step1", type: "filter", config };
  const ctx: RunContext = { data };
  return filterStep({ step, ctx, runId: "r", workflowId: "w", workspaceId: "ws", userId: "u" });
}

test("filter: equals operator passes when values match", async () => {
  const result = await run({ field: "trigger.status", operator: "equals", value: "urgent" }, { trigger: { status: "urgent" } });
  assert.equal(result.status, "success");
  assert.equal(result.output.passed, true);
});

test("filter: equals operator stops the run (not a failure) when values don't match", async () => {
  const result = await run({ field: "trigger.status", operator: "equals", value: "urgent" }, { trigger: { status: "low" } });
  assert.equal(result.status, "stopped_by_filter");
  assert.equal(result.output.passed, false);
});

test("filter: greater_than operator does numeric, not string, comparison", async () => {
  const result = await run({ field: "trigger.amount", operator: "greater_than", value: "100" }, { trigger: { amount: 250 } });
  assert.equal(result.status, "success");
  const blocked = await run({ field: "trigger.amount", operator: "greater_than", value: "100" }, { trigger: { amount: 50 } });
  assert.equal(blocked.status, "stopped_by_filter");
});

test("filter: contains operator on a string field", async () => {
  const result = await run({ field: "trigger.message", operator: "contains", value: "urgent" }, { trigger: { message: "this is urgent!" } });
  assert.equal(result.status, "success");
});

test("filter: exists operator treats empty string and missing as not existing", async () => {
  const missing = await run({ field: "trigger.optional", operator: "exists" }, { trigger: {} });
  assert.equal(missing.status, "stopped_by_filter");
  const empty = await run({ field: "trigger.optional", operator: "exists" }, { trigger: { optional: "" } });
  assert.equal(empty.status, "stopped_by_filter");
  const present = await run({ field: "trigger.optional", operator: "exists" }, { trigger: { optional: "x" } });
  assert.equal(present.status, "success");
});

test("filter: can reference a prior step's output, not just trigger data", async () => {
  const result = await run({ field: "step1.category", operator: "equals", value: "urgent" }, { step1: { category: "urgent" } });
  assert.equal(result.status, "success");
});

test("filter: the compare value itself can contain a merge field", async () => {
  const result = await run(
    { field: "trigger.a", operator: "equals", value: "{{trigger.b}}" },
    { trigger: { a: "match", b: "match" } }
  );
  assert.equal(result.status, "success");
});
