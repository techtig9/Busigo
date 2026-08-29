import { test } from "node:test";
import assert from "node:assert/strict";
import { signWebhookPayload, verifyWebhookSignature } from "../lib/security/webhook-signing";

test("signWebhookPayload: same secret+payload+timestamp always produces the same signature", () => {
  const a = signWebhookPayload("shh", '{"a":1}', 1000);
  const b = signWebhookPayload("shh", '{"a":1}', 1000);
  assert.equal(a.signature, b.signature);
  assert.equal(a.header, "t=1000,v1=" + a.signature);
});

test("signWebhookPayload: a different secret produces a different signature", () => {
  const a = signWebhookPayload("secret-a", "payload", 1000);
  const b = signWebhookPayload("secret-b", "payload", 1000);
  assert.notEqual(a.signature, b.signature);
});

test("verifyWebhookSignature: accepts a signature it just produced, within the replay window", () => {
  const { header } = signWebhookPayload("shh", "payload");
  const result = verifyWebhookSignature("shh", "payload", header);
  assert.equal(result.valid, true);
});

test("verifyWebhookSignature: rejects a tampered payload", () => {
  const { header } = signWebhookPayload("shh", "original payload");
  const result = verifyWebhookSignature("shh", "tampered payload", header);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "bad_signature");
});

test("verifyWebhookSignature: rejects the wrong secret", () => {
  const { header } = signWebhookPayload("secret-a", "payload");
  const result = verifyWebhookSignature("secret-b", "payload", header);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "bad_signature");
});

test("verifyWebhookSignature: rejects a timestamp outside the 5-minute replay window", () => {
  const staleTimestamp = Math.floor(Date.now() / 1000) - 10 * 60;
  const { header } = signWebhookPayload("shh", "payload", staleTimestamp);
  const result = verifyWebhookSignature("shh", "payload", header);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "expired");
});

test("verifyWebhookSignature: rejects a malformed or missing header instead of throwing", () => {
  assert.equal(verifyWebhookSignature("shh", "payload", null).reason, "malformed_header");
  assert.equal(verifyWebhookSignature("shh", "payload", "not-a-real-header").reason, "malformed_header");
  assert.equal(verifyWebhookSignature("shh", "payload", "t=abc,v1=xyz").reason, "malformed_header");
});

test("verifyWebhookSignature: replaying the exact same valid header twice both succeed (replay protection is time-window based, not single-use)", () => {
  const { header } = signWebhookPayload("shh", "payload");
  assert.equal(verifyWebhookSignature("shh", "payload", header).valid, true);
  assert.equal(verifyWebhookSignature("shh", "payload", header).valid, true);
});
