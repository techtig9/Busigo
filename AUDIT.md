# BusiGo — Audit

Resumable record of findings. Update after every phase.

Baseline on entry (branch `release/clean`, from `main` @ 9e6915a), all measured, not assumed:

| Gate | Result |
| --- | --- |
| `npm ci` | pass |
| `npm run typecheck` | pass |
| `npm run lint` (`--max-warnings=0`) | pass |
| `npm test` | 120 pass / 0 fail |
| `npx next build` with **no env vars** | pass, 46 routes |

So the base is not "partly broken" at the build level. The defects below are behavioural,
and the most serious one is invisible until a customer pays.

Scale: 46 pages, 16 API routes, 22 server-action modules, 50 components, 67 lib modules,
19 migrations, 108 tables with RLS enabled on all 108 and 392 policies.

## Findings

Priority: **P0** build/crash/login blocker · **P1** core feature broken · **P2** buttons/UX/layout · **P3** polish

| # | Issue | File | Pri | Status |
| --- | --- | --- | --- | --- |
| 1 | `PRICE_TO_PLAN` is an empty map with every entry commented out, and lookup falls back `\|\| "free"` — so every `subscription.created`/`subscription.updated` writes `plan: "free"` and free-tier credits. A customer pays Paddle and is recorded as free. | `app/api/webhooks/paddle/route.ts:32-36,56` | P0 | fixed (fadc1a3) |
| 2 | OAuth redirect URI and all three post-OAuth redirects fall back to `http://localhost:3000`. With `NEXT_PUBLIC_SITE_URL` unset in production, every app connection (Google, Slack, HubSpot, Notion, Airtable) sends the user to a dead localhost URL. | `lib/integrations/oauth.ts:36`, `app/api/integrations/oauth/callback/route.ts:8,19,20` | P1 | fixed (664b070) |
| 3 | 8 non-null assertions on env vars. This is the exact construct that made every request throw before the fail-closed guard; it remains one deleted guard away from returning. | `lib/supabase/client.ts:8-9`, `lib/supabase/server.ts:28-29,54-55`, `middleware.ts:53-54` | P1 | fixed (f5ebca3) |
| 4 | No rate limiting anywhere in the codebase. Auth endpoints allow unlimited credential attempts; `/api/ai/plan`, `/api/assistant/chat` and `/api/agents/orchestrate` allow unlimited paid AI calls. | all API routes | P1 | deferred to Phase 7 — the spec assigns rate limiting there ("rate-limited auth endpoints", "per-user and per-plan rate limits"); building it twice is waste |
| 5 | No account deletion and no data export. | — | P1 | deferred to Phase 7 — the spec assigns both there ("account deletion and data export") |
| 6 | Save has neither a pending state nor an error surface — the capability grid can be clicked repeatedly and a failed save looks identical to a successful one. | `components/workforce/AgentControls.tsx` | P2 | fixed (689ee75) |
| 7 | Send has no pending state; nothing prevents a second send while the first is in flight. | `components/assistant/ChatWidget.tsx` | P2 | fixed (689ee75) |
| 8 | Bypasses the design system entirely — raw `<input>/<select>/<textarea>/<button>` with ad-hoc classes — and its `<label>`s have no `htmlFor`/`id` association, so clicking a label does nothing and screen readers announce the fields unlabelled. This is the one page the customer's own end users see. | `app/form/[slug]/PublicFormClient.tsx` | P2 | fixed (689ee75) |
| 9 | Search has no error surface; a failed request is silent. | `components/layout/Topbar.tsx` | P2 | fixed (689ee75) |
| 10 | `.gitignore` misses `.env*` (only `.env` and `.env.local`), `dist`, `.vercel`, `*.zip`. | `.gitignore` | P2 | open |
| 11 | No `engines` field, so no declared Node version. | `package.json` | P2 | open |
| 12 | No OG image — every shared link renders a bare card. | — | P3 | open |
| 13 | No `AUDIT.md`, `FIXES.md`, `ROADMAP.md`, `docs/DEPLOY_VERCEL.md`. | — | P3 | open |
| 14 | No CI, no Dependabot, no PR template. | `.github/` | P3 | open |

## Verified sound (checked, no action needed)

- **AI provider order** is `["groq", "cerebras", "openrouter", "anthropic"]` as required (`lib/ai/provider.ts:31`).
- **Entitlements are enforced server-side**, not only in the UI: `canUseFeature` has 6 call sites and `deductRunCredits` 3, inside server actions and API routes.
- **One pricing source of truth.** `lib/pricing.ts` is pure and dependency-free; `lib/plans.ts` re-exports it and adds only the Supabase-backed access control. Not a duplicate.
- **RLS is complete** — 108 tables, 108 `enable row level security`, 392 policies.
- **No client constructed at module scope**, so no Supabase or API client is created at import or build time.
- **No `console.log`/`console.debug`** in shipped code.
- **`/dev/*` surfaces are double-gated** — the pages `notFound()` when `NODE_ENV === "production"` and the middleware allowance is itself dev-only.
- **No committed build output or `.env` files** in git.

## Design direction

Spec assigns busigo **navy + orange accent, animated workflow pipeline**.

Conflict worth stating once: the current system is violet ("Signal"), approved earlier in
this project. The spec names busigo explicitly and requires each product to have its own
palette, so navy + orange wins. The whole palette lives in CSS variables in
`app/globals.css`, so this is a token change, not a rewrite, and reverting is the same
change in the other direction.

## Next step

Phase 2 — fix in order: #1, then #2-#5, then #6-#11.


## Corrections to Phase 1

Two entries were wrong. Both surfaces had a different and worse defect than the one logged,
found while fixing them:

- **#7 ChatWidget** was logged as missing a pending state. It has one (`streaming`), and the
  submit button is disabled during it — the audit grep looked for `loading` and missed it.
  The real defect: `res.ok` was never checked, so a failed request's JSON error body was
  streamed into the transcript and rendered as the assistant replying `{"error":"..."}`.
- **#9 Topbar** was logged as "search has no error surface". Topbar has no search. It marks
  notifications read optimistically and fired the server action into a transition with no
  rejection handling, so a failed write still emptied the badge while the database disagreed.

## Findings added during Phase 2

Found while fixing the entries above, not present in the Phase 1 list:

| # | Issue | File | Pri | Status |
| --- | --- | --- | --- | --- |
| 15 | Paddle signature verification fell back to an empty HMAC key when `PADDLE_WEBHOOK_SECRET` was unset. HMAC with an empty key is computable, so on any deployment missing that variable anyone could sign their own `subscription.updated` and grant themselves Pro. | `app/api/webhooks/paddle/route.ts` | P0 | fixed (fadc1a3) |
| 16 | No webhook was idempotent. Paddle retries until it gets a 2xx and can redeliver after one, so a retried `transaction.completed` inserted a duplicate payment row and granted a credit top-up again. | `app/api/webhooks/paddle/route.ts` | P1 | fixed (fadc1a3) |
| 17 | `subscription.updated` reset `credits_remaining` to the full plan allowance on every event, including ones unrelated to entitlement — a customer who had spent 90% of their credits got them back by updating their card. | `app/api/webhooks/paddle/route.ts` | P1 | fixed (fadc1a3) |
| 18 | Credit top-ups were read-modify-write in application code; two transactions landing together lost one. | `app/api/webhooks/paddle/route.ts` | P1 | fixed (fadc1a3) |
| 19 | `emailRedirectTo`, password-reset `redirectTo` and workspace invite links fell back to `""`, producing **relative** URLs. Supabase requires absolute redirects and a relative href in an email is not a link, so signup confirmation, password reset and invitations all failed silently when `NEXT_PUBLIC_SITE_URL` was unset. | `lib/actions/auth.ts`, `lib/actions/workspace.ts` | P1 | fixed (664b070) |
| 20 | `PADDLE_API_KEY` was documented in `.env.example` but read by no code path. | `.env.example` | P3 | removed (Phase 2) |

## Phase 2 result

All P0 and P1 defects fixed except #4 and #5, which are Phase 7 deliverables by the spec's
own structure. All P2 code defects fixed; #10 (`.gitignore`) and #11 (`engines`) belong to
Phase 4 and are handled there.

`.env.example` rewritten: every variable the code reads, marked REQUIRED or OPTIONAL, with
its purpose and whether it is read at build time or per request. Verified complete by
diffing every `process.env.*` reference in the source against the file.

Gates after Phase 2: typecheck pass, lint pass (`--max-warnings=0`), 134 tests pass
(120 + 14 new), production build with **no environment variables** passes.

## Next step

Phase 3 — design system. Direction: navy + orange, animated workflow pipeline.
