# Phase 1 — Workspace / Organization Multi-Tenancy + Security Core

Master Spec sections covered: 2 (Workspace/organization architecture), 7 (Security —
MFA, API keys, webhooks), partially 47 (data model). Builds on PHASE_0_BASELINE_REPORT.md.

## What was built

### Database (supabase/migrations/20260822_phase18_workspace_foundation.sql, 20260822_phase18b_mfa_recovery_codes.sql)
- New tables: `workspaces`, `workspace_members`, `workspace_invitations`,
  `workspace_settings`, `workspace_api_keys`, `workspace_audit_log`,
  `workspace_webhook_deliveries`, plus a `workspace_role` enum (owner, admin,
  manager, member, viewer, billing_admin, security_admin) and rank-based
  `is_workspace_member()` / `workspace_role_at_least()` SQL functions used by
  every RLS policy below.
- `workspace_id` added, backfilled, and indexed across **all ~70 existing
  tenant-scoped tables** (businesses, workflows, runs, agents, approvals,
  connections, billing, growth, autonomous ops, marketplace, etc.) — generated
  programmatically from a table registry rather than hand-written, to avoid
  missing one across that many tables.
- Every one of those tables had its RLS policies dynamically dropped (by
  querying `pg_policies`, not by guessing old names — several existing
  policies had inconsistent auto-generated names) and replaced with
  workspace-membership policies: any member can read, `member` role or above
  can write, matching the spec's role list.
- Every existing user gets a personal workspace via a one-time backfill; every
  new signup (email/password *and* Google OAuth) gets one automatically.
- `workspace_usage` / `workspace_billing` satisfy the spec's naming as **views**
  over the now-workspace-scoped `usage_counters` / `subscriptions` tables
  rather than duplicate physical tables — avoids a second ledger that could
  drift out of sync. Full billing rework is Phase 3.
- `mfa_recovery_codes text[]` added to `users` (salted-hash storage only).

### Bugs found and fixed along the way (not part of the spec, found by actually running the SQL)
Two pre-existing migrations would have failed on a real, fresh Supabase project
following this repo's own documented setup (`schema.sql` then every file in
`migrations/` in order) — neither was ever caught because the old QA scripts
only did static checks, never executed the SQL:
- `business_os.sql` re-declared policies `schema.sql` already creates
  (duplicate-policy error, aborting the rest of that migration file — which
  meant `business_team_members`/`business_catalog_items`/
  `business_customer_segments` never got created at all). Made idempotent.
- `phase11_business_intelligence.sql` redefined `business_events` and
  `business_alerts` with extra columns (`occurred_at`, `processed`, `body`,
  etc.) that silently never got added, because both tables already existed
  from earlier files and `create table if not exists` no-ops. The
  business-intelligence page already queries `occurred_at`/`processed` — this
  would have been a runtime crash on first real load. Fixed via explicit
  `alter table add column if not exists`.
- Separately: **Google OAuth sign-in never created the `public.users` /
  `subscriptions` rows at all** (only the email/password path did). Every
  Business OS feature requires that row via foreign key, so this silently
  broke the entire product for anyone who signed up with Google — a
  pre-existing gap, not something this phase introduced, fixed in
  `app/auth/callback/route.ts` since workspace bootstrap needed to happen
  there anyway.

### Application layer
- `lib/workspace/{context,roles,authorize}.ts` — resolves the caller's active
  workspace + role from a `bg_workspace_id` cookie (falling back to their
  first/personal workspace), a rank-based `roleAtLeast()` check, and
  `requireWorkspace(minRole)` as the standard guard for server actions. RLS
  enforces the identical rule independently underneath — the app-layer check
  is a fast, friendly failure, not the only defense.
- `lib/actions/workspace.ts` — create workspace, switch (cookie), invite by
  email, resend/revoke invitation, accept invitation (token-based), role
  change, remove member, ownership transfer. Every mutation writes to
  `workspace_audit_log`.
- `lib/actions/mfa.ts` — TOTP enroll/verify/list/remove built on Supabase
  Auth's native MFA (not a custom implementation), plus recovery-code
  generation/redemption (salted-hash storage).
- `lib/actions/sessions.ts` — sign out other sessions / sign out everywhere,
  using Supabase Auth's sign-out scopes.
- `lib/actions/api-keys.ts` + `lib/security/{api-keys,api-key-verify}.ts` —
  workspace-scoped API keys: hashed storage, one-time plaintext reveal,
  prefix-based lookup, revocation. The verifier for incoming
  `Authorization: Bearer` requests is built but not yet wired into a public
  API route — no such route exists yet to protect.
- `lib/security/{webhook-signing,webhook-delivery-log}.ts` — HMAC-SHA256
  webhook signing in the Stripe/GitHub/Paddle `t=...,v1=...` shape, with a
  5-minute replay window, plus a delivery log. Signing/verification are pure
  functions split into their own file specifically so they stay unit-testable
  (see Testing below); not yet wired into the actual outbound webhook-response
  step or inbound `/api/hook/[token]` — that's the natural first consumer in
  Phase 6 (execution reliability) or whenever outbound webhook delivery is
  built out.
- UI: workspace switcher in the top nav (switch / create new), a workspace
  settings panel (team members + role changes, pending invitations, API keys,
  MFA enrollment, session revocation), and an invitation-acceptance page.
- `workflows.ts` and its five dependent pages (list, detail, runs list, run
  detail, forms) converted end-to-end to workspace scoping, as the reference
  pattern for converting the remaining ~15 action files. That conversion is
  **not yet done** for the other action files (business-os, workforce,
  connections, growth, autonomous-ops, etc.) — those still filter by
  `user_id`, which still works (nothing broke), but doesn't yet get the
  multi-tenant benefit. Converting them file-by-file as each area is worked
  is exactly how the Master Spec's own phase breakdown sequences this work
  (Phases 2–5 each touch a different subsystem).

## Known limitations (honest gaps, not silently dropped)
- **Sign-in does not yet challenge for MFA.** Enrollment, verification,
  listing, removal, and recovery codes all work, but `signInAction` doesn't
  check whether the account has a verified TOTP factor and prompt for the
  code (Supabase Auth's AAL1→AAL2 step-up). Until that's added, an enrolled
  factor doesn't actually gate sign-in yet — flagging this clearly rather
  than implying MFA is enforced end-to-end.
- Session management covers "sign out others" / "sign out everywhere" (via
  Supabase Auth's built-in scopes), not a per-session device/IP list — that
  needs the Supabase Admin API's session endpoints, not exposed in the client
  SDK.
- Only `workflows.ts` (+5 pages) is converted to workspace scoping; ~15 other
  action files still filter by `user_id`. Not broken, just not yet
  multi-tenant — same rollout plan as the spec's own phasing.
- Domain allowlisting / DNS revalidation for the HTTP Request step (spec
  section 7) wasn't touched this phase — existing SSRF protection is
  untouched and still active.

## Verification actually performed

**Database — executed against a real Postgres 16 instance (installed in this
sandbox), not just read for syntax:**
```
Fresh DB → schema.sql → all 17 migrations in order → 0 errors
Re-running the new migration a second time → 0 errors (idempotent)
Seeded 2 users; workspace + owner membership auto-created for both
Cross-tenant read as a non-member → 0 rows (was 1) — blocked correctly
Non-member insert into another workspace → rejected by RLS
Viewer role → can read, insert rejected by RLS
Admin role → can read and insert
```

**Application:**
```
npm run typecheck → 0 errors
npm test          → 75/75 pass (57 pre-existing + 18 new: webhook signing/
                     replay, API key generation/hashing, role-rank comparisons)
npm run qa        → PASS (16 migrations, 356 unique policies, 9 core routes)
npm run qa:final  → PASS (16 migrations, 356 unique policies, 25 dashboard routes)
npm run qa:ai     → PASS — Groq → Cerebras → OpenRouter → Anthropic unchanged
```

As with Phase 0: `next build` itself, and anything needing real Supabase/OAuth
credentials (actually creating an account through the UI, clicking an
invitation email, scanning a real QR code into an authenticator app), can't be
verified in this sandbox — no network access to Supabase or a browser.
Run the migration against a real Supabase project and click through
signup → invite teammate → accept → change role → enroll MFA → create an API
key before treating this as production-verified.
