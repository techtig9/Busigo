import { test } from "node:test";
import assert from "node:assert/strict";
import { generateApiKey, hashApiKey } from "../lib/security/api-keys";

test("generateApiKey: produces a key with the expected prefix and a prefix substring that matches its own start", () => {
  const { key, prefix } = generateApiKey();
  assert.ok(key.startsWith("bg_live_"));
  assert.ok(key.startsWith(prefix));
});

test("generateApiKey: two calls never produce the same key (random, not a collision)", () => {
  const a = generateApiKey();
  const b = generateApiKey();
  assert.notEqual(a.key, b.key);
});

test("hashApiKey: is deterministic for the same input", () => {
  const key = "bg_live_abc123";
  assert.equal(hashApiKey(key), hashApiKey(key));
});

test("hashApiKey: never returns the plaintext key itself", () => {
  const key = "bg_live_abc123";
  assert.notEqual(hashApiKey(key), key);
});

test("hashApiKey: different keys hash differently", () => {
  const { key: keyA } = generateApiKey();
  const { key: keyB } = generateApiKey();
  assert.notEqual(hashApiKey(keyA), hashApiKey(keyB));
});
