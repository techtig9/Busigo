# Phase 3 — Execution Reliability + Workspace-Centric Billing

Master Spec section covered: 8 (durable execution, retries, idempotency, workspace-centric
billing). Builds on Phases 0–2.

## The big finding this phase: a silent, phase-1-introduced outage

Phase 1's migration made `workflow_runs.workspace_id`, `subscriptions.workspace_id`, and
`payments.workspace_id` all `NOT NULL` — correct for the multi-tenancy model, but **nothing
in the application code was ever updated to actually set those columns on insert**. That
means, since Phase 1, on a real Supabase project:
- Every workflow run — webhook, form, manual test, and scheduled — would have failed to
  insert at all. The core product function was silently broken.
- Every new signup (email/password *and* Google OAuth) would have failed at the
  `subscriptions` insert, because the workspace didn't exist yet at the point that insert ran.
- Any real Paddle payment would have failed the same way in `payments`.

None of this surfaced in Phases 1–2 because I was testing schema/RLS correctness against a
live database, but hadn't yet exercised the *application insert paths* against it — this
phase's work (threading `workspaceId` through the execution engine for retries) is what
surfaced it. Found and fixed all of it:
- `app/api/hook/[token]/route.ts`, `app/api/form/[slug]/submit/route.ts`,
  `app/api/workflows/[id]/test-run/route.ts`, `app/api/cron/tick/route.ts` — every
  `workflow_runs` insert now sets `workspace_id`.
- `lib/actions/auth.ts`, `app/auth/callback/route.ts` — reordered to create the workspace
  *before* the subscription row, which now carries `workspace_id`.
- `app/api/webhooks/paddle/route.ts` — now keys everything off `workspace_id`.
- Verified all of the above by literally running the exact insert/update statements the
  code produces against live Postgres (see Verification below) — not just reading the code.

## Execution reliability

- **`lib/engine/retry.ts`** (pure, tested): classifies a failed `http_request` step as
  retryable (network error, 5xx, 429) or permanent (other 4xx, and — importantly — SSRF/
  self-trigger guard rejections, which look like network failures by shape but are
  deliberately permanent). `send_email` and `ai_action` are excluded on purpose: Resend
  already retries transient delivery failures, and the AI gateway already has its own
  provider failover — retrying the whole step on top of either would compound backoff on
  backoff for no benefit.
- **`executor.ts`**: a retryable failure now pauses the run and retries the *same* step
  with backoff (30s / 5min / 20min, 3 attempts) using the existing Delay-step pause/resume
  mechanism, rather than failing the whole run on the first transient blip. Retries
  exhausted → the run fails as before, but first gets recorded to `dead_letter_jobs`.
- **Dead-letter queue activated**: `dead_letter_jobs` existed since Phase 14 but nothing
  ever wrote to it. It's now real: `lib/platform/reliability.ts`'s `writeDeadLetter`, a
  "Dead-lettered steps" panel on the Runs page (Manager role or above), and a Replay action
  that re-runs the workflow from the failed step using the original trigger payload.
- **Inbound webhook idempotency activated**: `lib/platform/reliability.ts`'s
  `claimIdempotency`/`saveIdempotentResponse` existed since Phase 14, also never called from
  anywhere. The webhook hook route now honors an optional `Idempotency-Key` header —
  Stripe/GitHub-style — so a sender that retries a delivery (timeout, slow 2xx) gets the
  original run's cached response instead of triggering the workflow twice. Opt-in: no header,
  no change in behavior.

## Workspace-centric billing

- **`lib/plans.ts`**: `canUseFeature`/`deductRunCredits` converted from checking the acting
  user's own personal subscription to checking the **workspace's** shared plan and credit
  pool — this was a real multi-tenancy bug from Phase 1: a teammate invited into someone
  else's paid workspace was being gated by their own personal (usually free-tier)
  subscription, completely disconnected from the workspace they were actually working in.
  Platform-staff bypass (`users.role = 'admin'`, unrelated to workspace roles) is preserved,
  checked separately from which credit pool applies.
- Every call site converted: workflow create/publish/version-history, connect-app queueing,
  the webhook and form-submit trigger gates, and credit deduction in the executor.
- `createWorkspaceAction` now creates a default Free subscription for a newly-created team
  workspace (previously only personal workspaces got one, at signup).
- Paddle checkout (`CheckoutButton`, `BuyCreditsButton`) now sends `workspace_id` in
  `custom_data`; the webhook updates `subscriptions`/`payments` by workspace. The billing
  page is workspace-scoped and plan/credit-purchase actions are gated to Billing Admin/Admin/
  Owner — other members can see the workspace's plan and usage but not change it.
- Also converted the plan/credits display in the dashboard layout (top nav badge), the main
  dashboard page, the workflow builder's step-limit UI, and the Copilot's account-context
  (one query Phase 2 missed) — all now reflect the workspace, not the viewer.

## Known limitations (stated plainly)
- Retry/backoff is scoped to `http_request` only, as designed — not a gap, a deliberate
  boundary explained in `lib/engine/retry.ts`.
- A few purely-cosmetic `subscriptions.plan` reads (the connections page badge, a sentence
  of copy on the settings page) are still user-scoped. They don't gate any behavior — noted
  here rather than silently left, but not fixed this phase given the volume of functionally
  significant fixes already made.
- Notification fan-out on a run failure still goes to the workflow's original creator only,
  not every workspace member — reasonable for now, but worth revisiting alongside a broader
  notifications overhaul.
- No true distributed job queue (`system_jobs` remains unused) — retries/idempotency use the
  simpler pause/resume-via-cron mechanism already in place, which is adequate for this
  product's actual concurrency needs but wouldn't scale to a high-throughput job system.

## Verification actually performed

**Database — same live Postgres 16 instance used throughout:**
```
Fresh DB → schema.sql → all 18 migrations in order → 0 errors
Re-running the new migration a second time, including against a DB with real rows in it
  already → 0 errors (idempotent)
Manually ran the EXACT insert/update statements the new code produces:
  - full signup ordering (users → workspace → workspace_members → subscriptions) — the
    previously-broken path — succeeds end to end
  - workflow_runs insert with workspace_id set — succeeds (previously would have failed
    NOT NULL on every one of the 4 call sites)
  - dead_letter_jobs insert with no job_id/user_id — succeeds
  - Paddle webhook's update-by-workspace_id and a payments insert with no user_id — succeed
RLS: a workspace member reads their own subscription/dead-letter/payment rows; a direct
  client-side insert into dead_letter_jobs is correctly rejected (service-role-only write);
  a non-member sees zero rows across all three tables
```

**Application:**
```
npm run typecheck → 0 errors
npm test          → 91/91 pass (81 previous + 10 new: retry classification, backoff schedule)
npm run qa        → PASS (18 migrations, 357 unique policies, 9 core routes)
npm run qa:final  → PASS (18 migrations, 357 unique policies, 25 dashboard routes)
npm run qa:ai     → PASS — Groq → Cerebras → OpenRouter → Anthropic unchanged
```

As before: a live end-to-end trigger → transient-failure → automatic-retry → success (or
dead-letter → manual replay) cycle, and a real Paddle checkout completing and landing in
this workspace's subscription, both need verification against real infrastructure — this
sandbox can't reach Supabase, Paddle, or an external HTTP target to exercise them live.
