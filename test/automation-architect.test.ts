import { test } from "node:test";
import assert from "node:assert/strict";
import { architectAutomation, validateAutomationPlan } from "../lib/engine/automation-architect";

test("architect creates a lead workflow from natural language", () => {
  const plan = architectAutomation("When a new lead arrives, qualify it, email the lead, and follow up after one day.");
  assert.equal(plan.triggerType, "webhook");
  assert.ok(plan.steps.some(s => s.type === "ai_action"));
  assert.ok(plan.steps.some(s => s.type === "send_email"));
  assert.ok(plan.steps.some(s => s.type === "delay"));
  assert.equal(plan.safety.approvalRequired, true);
});

test("architect detects scheduled automations", () => {
  const plan = architectAutomation("Every morning, summarize my business events.");
  assert.equal(plan.triggerType, "schedule");
  assert.equal(plan.triggerConfig.cron, "0 9 * * *");
});

test("architect marks financial and destructive requests as high risk", () => {
  assert.equal(architectAutomation("Process customer refunds automatically").safety.risk, "high");
  assert.equal(architectAutomation("Delete old customer records automatically").safety.risk, "critical");
});

test("validator blocks unsafe incomplete side effects", () => {
  const plan = architectAutomation("Call an API");
  const result = validateAutomationPlan(plan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("HTTP endpoint")));
});
