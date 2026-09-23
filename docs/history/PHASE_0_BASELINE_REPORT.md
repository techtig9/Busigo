# Phase 0 — Baseline Stabilization Report

Before starting new work against the Master Spec, the existing Phase 17 codebase
was audited and brought to a genuinely clean baseline. This phase touched no
product behavior — only pre-existing bugs.

## Findings

`npm run typecheck` failed with 14 errors prior to this pass. All were real bugs,
not spec gaps:

1. **`components/ui/Badge.tsx`** — the `Tone` union type only allowed
   `signal | pulse | danger | warn | slate`, but seven pages
   (business-intelligence, connect, growth-engine, security-governance,
   workforce) already passed `success`, `warning`, `good`, `neutral`, `bad`.
   Extended the union and gave each alias a sensible color mapping instead of
   narrowing the call sites, since the call sites reflect real intended states.

2. **`lib/actions/agent-orchestration.ts`** — imported a non-existent
   `createClient` from `lib/supabase/server`; every other action file uses the
   real export `createServerSupabase`. This meant `createOrchestration()` would
   have thrown at runtime for every call. Fixed the import and call site.

3. **`lib/actions/connect.ts`** — `requestIntegrationAction` inserted the bare
   identifier `display_name` (undefined) into the `integration_accounts` row
   instead of the `displayName` variable it had just computed from the form.
   Every new integration request was silently saving a null display name.
   Fixed to reference the correct variable.

4. **`lib/engine/automation-architect.ts`** — the risk-escalation logic used
   ad-hoc `risk === "critical" ? risk : "medium"` comparisons that only worked
   by accident of check ordering (financial/destructive checks happen to run
   last). Replaced with a ranked `escalate()` helper so risk can only go up,
   regardless of future reordering of the scanning rules — fixes the type
   error and a latent correctness bug in the same change.

## Verification

```
npm run typecheck   → 0 errors (was 14)
npm test             → 57/57 pass
npm run qa           → PASS (14 migrations, 68 unique policies, 9 core routes)
npm run qa:final     → PASS (14 migrations, 68 unique policies, 25 dashboard routes)
npm run qa:ai        → PASS — Groq → Cerebras → OpenRouter → Anthropic
```

`next build` was not verifiable in the sandbox used for this pass — outbound
network is restricted to package registries, so `next/font` cannot reach
Google Fonts and Supabase/Paddle/Resend cannot be reached at all. This is an
environment limitation, not a code issue; run `npm run build` against real
credentials in CI/Vercel to confirm before deploying.

No ESLint config exists yet (`npm run lint` prompts interactively). Will be
added in a later phase alongside the CI pipeline.
