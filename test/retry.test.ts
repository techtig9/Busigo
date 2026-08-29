import { test } from "node:test";
import assert from "node:assert/strict";
import { isRetryableStepFailure, computeStepBackoffSeconds, MAX_STEP_RETRY_ATTEMPTS } from "../lib/engine/retry";

test("isRetryableStepFailure: only http_request steps are ever retried", () => {
  assert.equal(isRetryableStepFailure({ stepType: "send_email", output: null, error: "SMTP timeout" }), false);
  assert.equal(isRetryableStepFailure({ stepType: "ai_action", output: null, error: "provider down" }), false);
  assert.equal(isRetryableStepFailure({ stepType: "filter", output: null, error: "bad expression" }), false);
});

test("isRetryableStepFailure: a 5xx response is retryable", () => {
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: { status: 500 }, error: "Request returned HTTP 500" }), true);
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: { status: 503 }, error: "Request returned HTTP 503" }), true);
});

test("isRetryableStepFailure: a 429 response is retryable", () => {
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: { status: 429 }, error: "Request returned HTTP 429" }), true);
});

test("isRetryableStepFailure: a 4xx response other than 429 is not retryable", () => {
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: { status: 400 }, error: "Request returned HTTP 400" }), false);
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: { status: 401 }, error: "Request returned HTTP 401" }), false);
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: { status: 404 }, error: "Request returned HTTP 404" }), false);
});

test("isRetryableStepFailure: no response at all (network/timeout) is retryable", () => {
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: null, error: "Request timed out after 8000ms" }), true);
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: null, error: "fetch failed" }), true);
});

test("isRetryableStepFailure: SSRF/self-trigger guard rejections are never retryable, even though they also have no response", () => {
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: null, error: "Blocked target: request resolves to a private/internal IP range" }), false);
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: null, error: "Blocked: this HTTP Request step targets its own workflow's webhook URL (self-trigger loop guard)." }), false);
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: null, error: "Blocked protocol: file:" }), false);
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: null, error: "Invalid URL: not-a-url" }), false);
});

test("isRetryableStepFailure: a redirect response (300-399) is not retryable — it's a config problem, not transient", () => {
  assert.equal(isRetryableStepFailure({ stepType: "http_request", output: { status: 302 }, error: "Blocked: redirects are not followed" }), false);
});

test("computeStepBackoffSeconds: escalates across the fixed 30s / 5min / 20min schedule", () => {
  assert.equal(computeStepBackoffSeconds(1), 30);
  assert.equal(computeStepBackoffSeconds(2), 300);
  assert.equal(computeStepBackoffSeconds(3), 1200);
});

test("computeStepBackoffSeconds: clamps out-of-range attempt numbers instead of throwing", () => {
  assert.equal(computeStepBackoffSeconds(0), 30);
  assert.equal(computeStepBackoffSeconds(-5), 30);
  assert.equal(computeStepBackoffSeconds(99), 1200);
});

test("MAX_STEP_RETRY_ATTEMPTS matches the length of the backoff schedule", () => {
  assert.equal(MAX_STEP_RETRY_ATTEMPTS, 3);
});
