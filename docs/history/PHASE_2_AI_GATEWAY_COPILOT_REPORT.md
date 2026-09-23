# Phase 2 — AI Gateway Observability/Circuit-Breaker + Copilot Redesign

Master Spec section covered: 4 (AI gateway observability, provider circuit-breaker,
AI Copilot). Builds on Phase 0 and Phase 1.

## What was built

### AI gateway observability (lib/ai/observability.ts, migration 20260822_phase19)
- `ai_provider_events` (existed since Phase 8, unused as a write target until now)
  gained `request_id`, `failover_reason`, `error_class`, `credits_consumed`,
  `cost_estimate_usd`. `user_id` was relaxed to nullable — it was NOT NULL from
  the original table, but the gateway now logs every attempt itself, including
  from call sites with no single acting user in scope; `workspace_id` (NOT NULL,
  from Phase 1) is the real tenant key going forward.
- **Every provider attempt is now actually logged** — previously only the
  route handler logged a single row after a successful call; failed/failed-over
  attempts were invisible. `runBusinessAI` and the new `runBusinessAIStream`
  both log every attempt from inside the gateway itself, so the health
  dashboard shows real failover counts, not just successes.
- Deliberately logs a short task label and token/character counts only — never
  the prompt or account-context content.

### Circuit breaker (`ai_provider_cooldowns`, global — provider credentials are
shared env vars, not per-workspace, so cooldown state is platform-wide by design)
- A provider that returns a quota/rate-limit response gets a cooldown window
  (5 min, escalating ×failures, capped at 30 min) and is reordered to the back
  of the attempt list — not removed outright: if every provider happens to be
  cooling down, the gateway still tries them in original order rather than
  hard-failing on a prediction that might be wrong.
- Cooldown resets to zero on the next success.

### AI Studio → real provider health dashboard
Replaced the 3 static marketing cards with a live table: configured/not,
ready/cooling-down (with resume time), and this workspace's own 30-day call
count, error count, failover count, and average latency per provider — plus
last-24h estimated cost. The "Generate AI plan" form is unchanged and still
real.

### Copilot — unified onto the mandated AI gateway
The existing chat assistant (`/api/assistant/chat`) was calling **Google
Gemini directly** — a completely separate, unaccounted-for provider outside
the Groq → Cerebras → OpenRouter → Anthropic order the spec requires, with no
failover, no observability, and no cost tracking. This was a real deviation
from the spec, not a Phase 2 addition on top of working infrastructure — fixed
by:
- A new `runBusinessAIStream()` in `lib/ai/provider.ts`: same provider order
  and same quota/rate-limit-only failover rule as `runBusinessAI`, adapted for
  open-ended SSE streaming across both OpenAI-compatible providers
  (Groq/Cerebras/OpenRouter) and Anthropic's own SSE format. Failover only
  happens before the first byte of a provider's response streams to the
  caller; once a provider has started streaming, a mid-stream error is
  surfaced as-is rather than silently spliced with a second provider's
  continuation — the same all-or-nothing-per-provider behavior as
  `runBusinessAI`, just applied at the "first chunk" boundary instead of
  "whole response."
- The chat route now builds its account context from the **workspace**, not
  the user (consistent with Phase 1), and every message is logged through the
  same observability path as the plan generator.
- **Citations/evidence**: the response carries an `X-Copilot-Evidence` header
  — the real workflow/run records the account-context block was built from,
  not a parse of what the model claims to have cited (unreliable for free-text
  streaming) — rendered as clickable chips under each answer, linking to the
  actual workflow or run.
- **Page-aware suggested prompts**: the floating widget's starter prompts now
  change based on the current route (workflow detail, runs, settings,
  growth-engine, AI Studio) instead of one static list everywhere.

### Bug found and fixed
`runBusinessAI`'s two other call sites (`app/api/ai/plan/route.ts`,
`generateGrowthStrategyAction`) were still querying `businesses`/other tables
by `user_id` — the plan route's business lookup is now workspace-scoped; the
growth-strategy action gained `workspaceId` on its AI call for observability
without doing a full resource conversion (out of scope here — same "not yet
converted" list as the Phase 1 report).

## Known limitations (stated plainly, not silently dropped)
- **"Draft/create plan/simulate/request approval" Copilot actions were not
  built.** Giving the Copilot the ability to actually invoke create/simulate/
  approval server actions with a preview-before-execute UX is a genuinely
  separate, large feature (an agentic tool-use loop) — not attempted this
  phase. The Copilot remains advisory-only, as it explicitly tells the user.
- The "show me why" evidence drawer is chips-under-the-message, not a full
  drawer UI with a detailed reasoning trace.
- Per-provider real token usage (when a provider's API returns exact counts)
  isn't captured yet — `estimateTokens()` (character-count based) is used
  uniformly. Swapping in real usage figures where available is a small
  follow-up, not attempted here to avoid a partial, inconsistent accounting
  model across providers.
- Cost estimates use the existing flat `AI_ACTION_STEP` credit cost
  (`lib/pricing.ts`), not a true per-token, per-provider cost model — that
  belongs with the Phase 3 billing rework, not invented ad hoc here.

## Verification actually performed

**Database — against the same live Postgres 16 instance used in Phases 0–1:**
```
Fresh DB → schema.sql → all 18 migrations in order → 0 errors
Re-running the new migration a second time → 0 errors (idempotent)
Manually verified every insert/upsert/select shape the TypeScript code
  produces against the live schema (exact column names/types/constraints) —
  same class of bug Phase 1 caught (business_events) would have shown up here
Cross-tenant RLS: Alice sees her workspace's 2 seeded AI events, Bob sees 0
Both Alice and Bob can read the global provider cooldown row (correct —
  platform-wide, not tenant data)
A direct client-side insert into ai_provider_cooldowns is rejected by RLS
  (service-role-only write, as intended)
```

**Application:**
```
npm run typecheck → 0 errors
npm test          → 81/81 pass (75 previous + 6 new: token estimation,
                     cooldown escalation math)
npm run qa        → PASS (17 migrations, 357 unique policies, 9 core routes)
npm run qa:final  → PASS (17 migrations, 357 unique policies, 25 dashboard routes)
npm run qa:ai     → PASS — Groq → Cerebras → OpenRouter → Anthropic unchanged
```

As before: actually calling a live Groq/Cerebras/OpenRouter/Anthropic endpoint,
watching real streaming SSE parse correctly end-to-end, and confirming the
cooldown reorder behaves right under a genuine 429 can't be verified without
network access to those providers from this sandbox. Test the Copilot against
real provider keys — including forcing a 429 on the primary provider to watch
it fail over and cool down — before treating this as production-verified.
