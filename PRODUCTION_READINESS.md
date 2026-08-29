# Production Readiness Checklist

Updated at the end of Phase 5 — the prior version of this file predated workspace
multi-tenancy and everything since. Split into what this repo's own tests/migrations verify
automatically, what needs a human to check against real infrastructure (none of which could
be exercised inside the sandbox these phases were built in — no network access to Supabase,
Paddle, Resend, or any AI provider; no browser), and a manual staging walkthrough.

## ✅ Verified automatically, every phase, against a real database
- `npm run typecheck`, `npm test`, `npm run qa`, `npm run qa:final`, `npm run qa:ai` all pass.
- All 18 migrations apply cleanly, in order, from a completely empty database — and the newer
  ones apply idempotently a second time, including against a database with real rows in it.
- Every RLS policy has been directly tested (not just read for correctness) with two seeded
  users: cross-tenant reads/writes are rejected, role-based write restrictions work, and
  system-only tables reject direct client writes.
- Every place that creates a `workflow_runs`, `subscriptions`, or `payments` row was verified
  to actually satisfy the `NOT NULL workspace_id` constraint Phase 1 introduced — several of
  these were silently broken between Phase 1 and when Phase 3 caught and fixed them (see that
  phase's report for the full list).

## ⚠️ Needs your action before a real launch

**Supabase project**
- [ ] Run `supabase/schema.sql`, then every file in `supabase/migrations/` in filename order,
      against your actual Supabase project (not just this sandbox's local Postgres).
- [ ] Run `supabase/seed.sql` once, manually, for the starter workflow templates — it is not
      part of the migration chain and won't run automatically.
- [ ] Confirm email delivery is configured in Supabase Auth (or you're using Resend for
      transactional email — `RESEND_API_KEY`) — signup verification and password reset both
      depend on this.
- [ ] Configure the Google OAuth provider in the Supabase Auth dashboard if you want
      "Continue with Google" to work (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env` are
      for *integration* connections, i.e. the Connections page — the Supabase Auth Google
      provider is configured separately, in the Supabase dashboard).
- [ ] Configure OAuth redirect URL allowlists for every connected-integration provider
      (Slack, HubSpot, Notion, Airtable, Google) in each provider's own developer console.

**Paddle**
- [ ] Real price IDs for every plan (monthly + yearly) and every credit top-up pack — see the
      `NEXT_PUBLIC_PADDLE_PRICE_*` variables in `.env.example`, all newly documented this
      phase (three yearly-plan price IDs were referenced in code but never listed there).
- [ ] `PADDLE_WEBHOOK_SECRET` set to the real value from your Paddle webhook configuration —
      the handler verifies every inbound webhook's HMAC signature and silently drops anything
      that doesn't match, so a wrong or missing secret means billing events never apply.
- [ ] Point the Paddle webhook endpoint at `/api/webhooks/paddle` on your real domain.

**AI providers**
- [ ] At minimum, `GROQ_API_KEY`. Cerebras, OpenRouter, and Anthropic keys are optional
      fallbacks — without them, the gateway still works, it just has fewer providers to fail
      over to.
- [ ] `GOOGLE_AI_API_KEY` is no longer used anywhere as of this phase (the AI Action workflow
      step was calling Gemini directly, bypassing the provider gateway entirely — found and
      fixed this phase; it's now on the same Groq→Cerebras→OpenRouter→Anthropic path as
      everything else). No action needed — noted here so its absence isn't mistaken for an
      oversight.

**Cron**
- [ ] `CRON_SECRET` set to a real random value, and something actually calling
      `GET /api/cron/tick` on a schedule (every 1–2 minutes is reasonable) with
      `Authorization: Bearer <CRON_SECRET>` — this is what resumes paused/retrying runs and
      fires scheduled workflows. Vercel Cron, a GitHub Action, or any external scheduler all
      work; nothing calls this automatically on its own.

**Domain & security**
- [ ] `NEXT_PUBLIC_SITE_URL` set to your real production domain — used in email links,
      OAuth redirects, and workspace invitation links.
- [ ] The security headers added this phase (`next.config.js`) include a real Content-Security-
      Policy — review `PADDLE_SCRIPT`/`PADDLE_FRAME` in that file if you integrate any other
      third-party script or embed, since the CSP is a real allowlist, not a placeholder.
- [ ] `script-src` in that CSP still includes `'unsafe-inline'`, needed for Next.js App
      Router's own inline hydration scripts without a nonce-based CSP setup (a larger change,
      not attempted this phase) — this is a real, currently-accepted gap, not an oversight.
- [ ] `BUSIGO_TOKEN_ENCRYPTION_KEY` and `OAUTH_STATE_SECRET` set to real random values — these
      encrypt stored OAuth tokens for connected integrations.
- [ ] Never expose `SUPABASE_SERVICE_ROLE_KEY` or any provider secret to client code — every
      use of it in this codebase is inside a `"use server"` file or an API route.
- [ ] Keep destructive/financial workflow actions approval-gated; keep SSRF protections
      enabled for user-supplied URLs (`lib/engine/ssrf-guard.ts`) — both already on by
      default, called out here as things to never disable, not things left to configure.

**Monitoring & operations** (not built this phase — genuinely open)
- [ ] No external error-tracking (Sentry or similar) is wired in. Failures are logged to
      `console.error` (visible in Vercel/hosting logs) and, for workflow runs specifically, to
      `workspace_audit_log`/`dead_letter_jobs`/`ai_provider_events` — but there's no alerting
      if, say, every AI provider starts failing at 3am.
- [ ] No automated database backup strategy is configured by this codebase — that's a Supabase
      project setting (point-in-time recovery, backup retention) to turn on directly.
- [ ] No uptime/synthetic monitoring. `GET /api/platform/health` exists and returns real
      status — point an external uptime checker at it.

## Manual staging walkthrough
Run through this against a real deployment before launch — none of it can be exercised in
the sandbox this codebase was built in:
- Sign up, verify email, sign in, sign out; sign in with Google.
- Enroll an authenticator app in Settings, sign out, sign back in — confirm the MFA
  challenge screen actually appears and blocks access without the code.
- Create a second workspace, invite a teammate by email, accept the invitation as that
  teammate, confirm their role and the workspace's shared plan/credits apply to them.
- Business Brain onboarding.
- Connect an integration and revoke it.
- Build a workflow on the canvas with a Filter step branching two ways; publish it; trigger
  it twice with the same `Idempotency-Key` header and confirm only one run executes.
- Force a downstream HTTP Request step to fail (point it at a dead endpoint) and confirm it
  retries with backoff, then lands in the Dead-lettered steps panel; replay it.
- Generate and simulate an AI automation; run an AI Action step inside a real workflow and
  confirm it appears in AI Studio's provider health table.
- Complete a real Paddle checkout (sandbox mode) and confirm the workspace's plan/credits
  update from the webhook.
- Verify tenant isolation with two separate workspaces, not just two users in one.
