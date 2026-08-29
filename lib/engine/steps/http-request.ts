import type { StepHandler } from "../types";
import { resolveConfig } from "../merge-fields";
import { targetsOwnWebhook } from "../guard-self-trigger";
import { assertSafeTarget } from "../ssrf-guard";

// Hard Constraint 8: the HTTP Request action makes a live outbound call, on a schedule or in
// response to arbitrary inbound data, using the account's own server. Treated as a real SSRF
// surface — assertSafeTarget (lib/engine/ssrf-guard.ts) resolves and rejects requests
// targeting private/internal IP ranges, loopback, link-local, and the cloud metadata address
// before this step ever calls fetch(). Also enforces an 8s timeout and a 100KB response cap.

const TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 100 * 1024;

async function readCapped(response: Response, capBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > capBytes) {
      out += decoder.decode(value.subarray(0, Math.max(0, capBytes - (received - value.byteLength))));
      await reader.cancel();
      out += "\n...[response truncated at 100KB]";
      break;
    }
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

export const httpRequestStep: StepHandler = async ({ step, ctx, workflowId }) => {
  const config = resolveConfig(step.config, ctx.data) as {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  };

  if (await targetsOwnWebhook(config.url, workflowId)) {
    return {
      status: "failed",
      output: null,
      error: "Blocked: this HTTP Request step targets its own workflow's webhook URL (self-trigger loop guard).",
    };
  }

  let safeUrl: URL;
  try {
    safeUrl = await assertSafeTarget(config.url);
  } catch (e: any) {
    return { status: "failed", output: null, error: e.message };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const method = (config.method || "GET").toUpperCase();
    const res = await fetch(safeUrl.toString(), {
      method,
      headers: config.headers,
      body: method === "GET" || method === "HEAD" ? undefined : config.body,
      signal: controller.signal,
      redirect: "manual", // a redirect to an internal target would bypass the SSRF check above
    });

    if (res.status >= 300 && res.status < 400) {
      return {
        status: "failed",
        output: { status: res.status },
        error: "Blocked: redirects are not followed (would bypass SSRF protection). Point the step at the final URL directly.",
      };
    }

    const bodyText = await readCapped(res, MAX_RESPONSE_BYTES);
    const output = { status: res.status, ok: res.ok, body: bodyText };

    return res.ok
      ? { status: "success", output }
      : { status: "failed", output, error: `Request returned HTTP ${res.status}` };
  } catch (e: any) {
    const message = e.name === "AbortError" ? `Request timed out after ${TIMEOUT_MS}ms` : e.message;
    return { status: "failed", output: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
};
