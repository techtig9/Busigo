import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateTokens, computeCooldownMinutes } from "../lib/ai/pure";

test("estimateTokens: empty string is zero tokens", () => {
  assert.equal(estimateTokens(""), 0);
});

test("estimateTokens: roughly 4 characters per token, rounded up", () => {
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
  assert.equal(estimateTokens("a".repeat(400)), 100);
});

test("computeCooldownMinutes: first failure is the 5-minute base", () => {
  assert.equal(computeCooldownMinutes(1), 5);
});

test("computeCooldownMinutes: escalates linearly with repeated failures", () => {
  assert.equal(computeCooldownMinutes(2), 10);
  assert.equal(computeCooldownMinutes(3), 15);
  assert.equal(computeCooldownMinutes(4), 20);
});

test("computeCooldownMinutes: caps at 30 minutes regardless of how many failures", () => {
  assert.equal(computeCooldownMinutes(6), 30);
  assert.equal(computeCooldownMinutes(50), 30);
});

test("computeCooldownMinutes: treats zero or negative failure counts as at least one", () => {
  assert.equal(computeCooldownMinutes(0), 5);
  assert.equal(computeCooldownMinutes(-1), 5);
});
