import "server-only";
import { getProviderCooldowns, logAIProviderEvent, recordProviderFailure, recordProviderSuccess } from "./observability";
import { estimateTokens } from "./pure";
import type { AIErrorClass } from "./observability";

export type AIProviderName = "groq" | "cerebras" | "openrouter" | "anthropic";

export type BusinessAIRequest = {
  task: string;
  context?: Record<string, unknown>;
  schema?: Record<string, unknown>;
  /** Enables per-attempt observability logging (see lib/ai/observability.ts). Omit only for call sites with no workspace in scope yet. */
  workspaceId?: string;
};

export type BusinessAIResponse = {
  result: Record<string, unknown>;
  provider: AIProviderName;
  model: string;
  attempts: AIProviderName[];
};

export type ProviderConfig = {
  name: AIProviderName;
  key?: string;
  url: string;
  model: string;
  kind: "openai-compatible" | "anthropic";
};

export const PROVIDER_ORDER: AIProviderName[] = ["groq", "cerebras", "openrouter", "anthropic"];

export function configuredProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [
    {
      name: "groq",
      key: process.env.GROQ_API_KEY,
      url: process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      kind: "openai-compatible",
    },
    {
      name: "cerebras",
      key: process.env.CEREBRAS_API_KEY,
      url: process.env.CEREBRAS_API_URL || "https://api.cerebras.ai/v1/chat/completions",
      model: process.env.CEREBRAS_MODEL || "llama-3.3-70b",
      kind: "openai-compatible",
    },
    {
      name: "openrouter",
      key: process.env.OPENROUTER_API_KEY,
      url: process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1/chat/completions",
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      kind: "openai-compatible",
    },
    {
      name: "anthropic",
      key: process.env.ANTHROPIC_API_KEY,
      url: process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1/messages",
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      kind: "anthropic",
    },
  ];

  return providers.filter((provider) => Boolean(provider.key));
}

/**
 * Configured providers in PROVIDER_ORDER, but with any currently-cooling-down
 * provider moved to the back instead of removed — see the comment on
 * getProviderCooldowns() in observability.ts for why this is a reorder, not a
 * hard filter. If every provider happens to be cooling down, this returns them
 * all anyway, in original order, rather than an empty list.
 */
async function orderedProvidersWithCooldownAwareness(): Promise<ProviderConfig[]> {
  const configured = configuredProviders();
  const ordered = PROVIDER_ORDER.map((name) => configured.find((p) => p.name === name)).filter(Boolean) as ProviderConfig[];

  let cooldowns: Awaited<ReturnType<typeof getProviderCooldowns>> = [];
  try {
    cooldowns = await getProviderCooldowns();
  } catch (e) {
    // Cooldown state is an optimization, not a correctness requirement — if the lookup itself
    // fails (e.g. during local dev without a DB), fall back to the plain configured order.
    return ordered;
  }
  const activelyCoolingDown = new Set(cooldowns.filter((c) => c.isActive).map((c) => c.provider));
  if (activelyCoolingDown.size === 0) return ordered;

  const healthy = ordered.filter((p) => !activelyCoolingDown.has(p.name));
  const cooling = ordered.filter((p) => activelyCoolingDown.has(p.name));
  return [...healthy, ...cooling];
}

function buildPrompt(input: BusinessAIRequest) {
  const system = `You are BusiGo's business operating AI. Produce practical, conservative, auditable outputs. Never invent connected data. If information is missing, say so. Prefer reversible actions and require human approval for financial, legal, destructive, external-publishing, or otherwise high-risk actions. Return valid JSON only. Do not wrap JSON in markdown fences.`;
  const prompt = `${input.task}\n\nBUSINESS CONTEXT:\n${JSON.stringify(input.context ?? {}, null, 2)}\n\nOUTPUT SCHEMA:\n${JSON.stringify(input.schema ?? { result: "object" }, null, 2)}`;
  return { system, prompt };
}

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        // Continue to the stable error below.
      }
    }
    throw new Error("AI provider returned invalid JSON.");
  }
}

async function readProviderError(response: Response): Promise<string> {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error === "object" && parsed.error.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {
    // Use raw response below.
  }
  return raw.slice(0, 1000) || `HTTP ${response.status}`;
}

function isQuotaOrRateLimit(response: Response, message: string): boolean {
  if ([402, 429].includes(response.status)) return true;
  const text = message.toLowerCase();
  return ["rate limit", "rate_limit", "quota", "too many requests", "credits exhausted", "insufficient credits", "usage limit", "limit exceeded"].some((term) => text.includes(term));
}

function classifyError(status: number | undefined, quotaOrRateLimit: boolean): AIErrorClass {
  if (quotaOrRateLimit) return "quota_or_rate_limit";
  if (status === 401 || status === 403) return "auth_error";
  if (status === undefined) return "network_error";
  return "other";
}

async function callOpenAICompatible(provider: ProviderConfig, system: string, prompt: string): Promise<Record<string, unknown>> {
  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.key}`,
      ...(provider.name === "openrouter" ? { "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://busigo.app", "X-Title": "BusiGo" } : {}),
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.2,
      max_tokens: 3000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    const error = new Error(`${provider.name}: ${message}`) as Error & { quotaOrRateLimit?: boolean; status?: number };
    error.quotaOrRateLimit = isQuotaOrRateLimit(response, message);
    error.status = response.status;
    throw error;
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${provider.name}: empty AI response.`);
  return extractJson(text);
}

async function callAnthropic(provider: ProviderConfig, system: string, prompt: string): Promise<Record<string, unknown>> {
  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.key || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 3000,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    const error = new Error(`${provider.name}: ${message}`) as Error & { quotaOrRateLimit?: boolean; status?: number };
    error.quotaOrRateLimit = isQuotaOrRateLimit(response, message);
    error.status = response.status;
    throw error;
  }

  const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = data.content?.filter((item) => item.type === "text").map((item) => item.text || "").join("\n").trim();
  if (!text) throw new Error(`${provider.name}: empty AI response.`);
  return extractJson(text);
}

export async function runBusinessAI(input: BusinessAIRequest): Promise<BusinessAIResponse> {
  const { system, prompt } = buildPrompt(input);
  const ordered = await orderedProvidersWithCooldownAwareness();

  if (!ordered.length) {
    throw new Error("No AI provider is configured. Add GROQ_API_KEY first; Cerebras, OpenRouter, and Anthropic are optional fallbacks.");
  }

  const attempts: AIProviderName[] = [];
  const failures: string[] = [];
  const requestId = crypto.randomUUID();
  const inputTokensEstimate = estimateTokens(prompt);

  for (let i = 0; i < ordered.length; i++) {
    const provider = ordered[i];
    attempts.push(provider.name);
    const startedAt = Date.now();
    try {
      const result = provider.kind === "anthropic"
        ? await callAnthropic(provider, system, prompt)
        : await callOpenAICompatible(provider, system, prompt);

      if (input.workspaceId) {
        await Promise.all([
          recordProviderSuccess(provider.name),
          logAIProviderEvent({
            workspaceId: input.workspaceId,
            requestId,
            provider: provider.name,
            model: provider.model,
            task: input.task.slice(0, 80),
            status: "succeeded",
            latencyMs: Date.now() - startedAt,
            inputTokensEstimate,
            outputTokensEstimate: estimateTokens(JSON.stringify(result)),
            failoverReason: i > 0 ? `previous provider(s) failed: ${failures.join("; ").slice(0, 200)}` : undefined,
          }),
        ]);
      }
      return { result, provider: provider.name, model: provider.model, attempts };
    } catch (error) {
      const typed = error as Error & { quotaOrRateLimit?: boolean; status?: number };
      failures.push(typed.message);
      const errorClass = classifyError(typed.status, Boolean(typed.quotaOrRateLimit));

      if (input.workspaceId) {
        await Promise.all([
          typed.quotaOrRateLimit ? recordProviderFailure(provider.name, typed.message) : Promise.resolve(),
          logAIProviderEvent({
            workspaceId: input.workspaceId,
            requestId,
            provider: provider.name,
            model: provider.model,
            task: input.task.slice(0, 80),
            status: "failed",
            latencyMs: Date.now() - startedAt,
            inputTokensEstimate,
            errorClass,
          }),
        ]);
      }

      if (!typed.quotaOrRateLimit) {
        throw new Error(`${typed.message} Provider fallback was not attempted because this is not a rate/quota exhaustion response.`);
      }
    }
  }

  throw new Error(`All configured AI providers are unavailable or rate/quota limited. Attempts: ${attempts.join(" → ")}. ${failures.join(" | ")}`);
}

export function getAIProviderStatus() {
  return PROVIDER_ORDER.map((name) => {
    const provider = configuredProviders().find((item) => item.name === name);
    return { provider: name, configured: Boolean(provider?.key), model: provider?.model ?? null };
  });
}

// --- Streaming gateway (Copilot) -------------------------------------------------------

export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface StreamAttemptResult {
  provider: AIProviderName;
  model: string;
  /** True once at least one chunk was successfully delivered to onChunk for this attempt. */
  committed: boolean;
}

/**
 * Same provider order and quota/rate-limit-only failover rule as runBusinessAI,
 * adapted for open-ended streaming chat instead of single-shot structured JSON.
 *
 * Failover only happens BEFORE the first byte of a provider's response is
 * streamed to the caller (a non-OK HTTP status, checked before reading the
 * body). Once streaming has started for a provider, any error partway through
 * is surfaced as-is rather than silently retried on another provider — by
 * that point the caller has already seen partial output, and silently
 * splicing in a second provider's continuation would produce an incoherent,
 * unreviewable response. This mirrors runBusinessAI's per-provider all-or-
 * nothing behavior; it's just applied at the "first chunk" boundary instead
 * of "whole response" boundary.
 */
export async function runBusinessAIStream(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  opts: { workspaceId: string; task: string; maxTokens?: number }
): Promise<StreamAttemptResult> {
  const ordered = await orderedProvidersWithCooldownAwareness();
  if (!ordered.length) throw new Error("No AI provider is configured.");

  const requestId = crypto.randomUUID();
  const inputTokensEstimate = estimateTokens(messages.map((m) => m.content).join("\n"));
  const failures: string[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const provider = ordered[i];
    const startedAt = Date.now();
    let outputChars = 0;

    try {
      const response = await openStream(provider, messages, opts.maxTokens ?? 800);
      if (!response.ok) {
        const message = await readProviderError(response);
        const error = new Error(`${provider.name}: ${message}`) as Error & { quotaOrRateLimit?: boolean; status?: number };
        error.quotaOrRateLimit = isQuotaOrRateLimit(response, message);
        error.status = response.status;
        throw error;
      }
      if (!response.body) throw new Error(`${provider.name}: no response body.`);

      await pumpStream(provider, response.body, (chunk) => {
        outputChars += chunk.length;
        onChunk(chunk);
      });

      await Promise.all([
        recordProviderSuccess(provider.name),
        logAIProviderEvent({
          workspaceId: opts.workspaceId,
          requestId,
          provider: provider.name,
          model: provider.model,
          task: opts.task.slice(0, 80),
          status: "succeeded",
          latencyMs: Date.now() - startedAt,
          inputTokensEstimate,
          outputTokensEstimate: Math.ceil(outputChars / 4),
          failoverReason: i > 0 ? `previous provider(s) failed: ${failures.join("; ").slice(0, 200)}` : undefined,
        }),
      ]);
      return { provider: provider.name, model: provider.model, committed: true };
    } catch (error) {
      const typed = error as Error & { quotaOrRateLimit?: boolean; status?: number };

      if (outputChars > 0) {
        // Already streamed partial content to the caller — surface the error inline
        // rather than attempting a silent, incoherent handoff to another provider.
        onChunk("\n\n(The response was interrupted — please try asking again.)");
        await logAIProviderEvent({
          workspaceId: opts.workspaceId, requestId, provider: provider.name, model: provider.model,
          task: opts.task.slice(0, 80), status: "failed", latencyMs: Date.now() - startedAt,
          inputTokensEstimate, errorClass: classifyError(typed.status, Boolean(typed.quotaOrRateLimit)),
        });
        return { provider: provider.name, model: provider.model, committed: true };
      }

      failures.push(typed.message);
      await Promise.all([
        typed.quotaOrRateLimit ? recordProviderFailure(provider.name, typed.message) : Promise.resolve(),
        logAIProviderEvent({
          workspaceId: opts.workspaceId, requestId, provider: provider.name, model: provider.model,
          task: opts.task.slice(0, 80), status: "failed", latencyMs: Date.now() - startedAt,
          inputTokensEstimate, errorClass: classifyError(typed.status, Boolean(typed.quotaOrRateLimit)),
        }),
      ]);

      if (!typed.quotaOrRateLimit) throw new Error(`${typed.message}`);
      // else: fall through to the next provider in the loop.
    }
  }

  throw new Error(`All configured AI providers are unavailable. Attempts: ${ordered.map((p) => p.name).join(" → ")}. ${failures.join(" | ")}`);
}

async function openStream(provider: ProviderConfig, messages: ChatMessage[], maxTokens: number): Promise<Response> {
  if (provider.kind === "anthropic") {
    const system = messages.find((m) => m.role === "system")?.content;
    const rest = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    return fetch(provider.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": provider.key || "", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: provider.model, max_tokens: maxTokens, temperature: 0.3, system, messages: rest, stream: true }),
    });
  }
  return fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.key}`,
      ...(provider.name === "openrouter" ? { "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://busigo.app", "X-Title": "BusiGo" } : {}),
    },
    body: JSON.stringify({ model: provider.model, temperature: 0.3, max_tokens: maxTokens, messages, stream: true }),
  });
}

async function pumpStream(provider: ProviderConfig, body: ReadableStream<Uint8Array>, emit: (text: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const text = provider.kind === "anthropic"
          ? (parsed.type === "content_block_delta" ? parsed.delta?.text : undefined)
          : parsed.choices?.[0]?.delta?.content;
        if (text) emit(text);
      } catch {
        // Partial/malformed SSE chunk — skip it rather than crash the whole stream.
      }
    }
  }
}
