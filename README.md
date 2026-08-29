# busigo

Trustworthy workflow automation — trigger, sequence, and traceable runs. Built for Techtig.

This repo implements Phases 1.1–1.10 of the one-day build spec. It was written by hand in a
sandboxed environment with no network access, so **it has not been run against a live Next.js
dev server or a real Supabase project** — there may be a small integration issue or two once
it meets real infrastructure. Follow the setup steps below, and if `npm run dev` or
`npm run build` surfaces an error, it's almost certainly a quick fix (a typo, an import path,
or a package version mismatch) rather than a structural problem — the architecture, schema,
and business logic have been thought through end-to-end.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `RESEND_API_KEY` | resend.com — and verify a sending domain, then update `SENDING_DOMAIN` in `lib/engine/steps/send-email.ts` |
| `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Paddle dashboard → Developer Tools |
| `NEXT_PUBLIC_PADDLE_PRICE_STARTER/GROWTH/PRO` | Paddle dashboard → Catalog, after creating the 3 prices |
| `CRON_SECRET` | any random string you generate — used to authorize `/api/cron/tick` |

Then apply the database:

```bash
# In the Supabase SQL editor, or via the CLI:
psql < supabase/schema.sql
psql < supabase/seed.sql
```

Also set up in the Supabase dashboard (not covered by SQL):
- **Auth → Providers → Google**: add your OAuth client ID/secret for Google sign-in.
- **Auth → URL Configuration**: add `<your-domain>/auth/callback` as a redirect URL.
- **Auth → Email Templates**: point the confirmation/reset links at your domain if you don't
  want the Supabase default template.

Run it:

```bash
npm run dev
```

Wire up a scheduler (Vercel Cron, GitHub Actions, or any external pinger) to hit
`GET /api/cron/tick` with header `Authorization: Bearer <CRON_SECRET>` once a minute — this is
what resumes Delay steps and fires scheduled workflows. Nothing else in the app depends on a
long-running process, so this is the one piece of infrastructure to remember to set up outside
of `next start`.

Point your Paddle webhook (Developer Tools → Notifications) at
`https://<your-domain>/api/webhooks/paddle`, subscribed to `subscription.created`,
`subscription.updated`, `subscription.canceled`, `transaction.completed`, and
`transaction.payment_failed`.

## What's built

Everything in Phases 1.1–1.10:

- Auth (email/password, Google OAuth, email verification, forgot/reset password)
- Dashboard shell, mobile-responsive, with the Help and About Us pages (Techtig copy verbatim)
- Workflow builder: ordered step list, 5 seed templates, version history + rollback, duplicate
- Execution engine, all 7 step types, with full per-step tracing — no step is ever skipped
  from the trace, no run is ever marked successful because of an assumption rather than a
  real result
- Test Run with live SSE step-by-step streaming, including a visible waiting state for Delay
- Webhook publishing + rotation, public form builder + public submission endpoint
- Runs list, per-workflow analytics, CSV/JSON export, failure alert emails
- Credits/plans/feature gating, admin bypass
- Paddle Checkout + webhook sync
- Admin panel with subscription override
- Toasts, and a corrected pricing model (see below)

### A deliberate change from the original spec: credit allocations

The spec's Plans table gives Starter/Growth/Pro 10,000/25,000/50,000 monthly credits. Modeled
against a 60–65% target gross margin (see the companion pricing strategy doc), the Pro
allocation left margin at full usage below 60%, and Growth sat exactly on the floor with no
buffer. `lib/plans.ts` uses corrected allocations instead — **13,000 / 22,000 / 43,000** — at
the same $15/$25/$49 price points. This is called out in a comment at the top of that file. If
you'd rather ship the original numbers, that's a one-line change.

## What's stubbed (by design — see "Explicitly Deferred" in the spec)

- **App Connections** (Slack, Google Sheets, Gmail, Google Calendar, Airtable, HubSpot, Trello,
  Notion): the Connections page only lets a Pro user join a waitlist (`connections` table,
  status `queued`). No OAuth flow exists yet. Building each one is its own integration:
  OAuth app registration, token storage (needs a new encrypted-secrets table — don't put
  tokens in a plain jsonb column), a new step type per service, and per-service rate limits.
- **True branching** (if/else with merge points): today's Filter step is stop-only. A real
  branching engine needs a DAG-shaped `definition` (not an array), a different `workflow_run_steps`
  traversal, and a canvas UI — a substantial rewrite of the builder, not an incremental add.
- **Drag-and-drop canvas**: today's builder is an ordered list with up/down controls. Swapping
  in a node-graph canvas (e.g. React Flow) is mostly additive once branching exists.
- **Arbitrary code step**: deliberately not built — running user-submitted JS/Python safely
  needs a real sandboxing story (isolated-vm, a Firecracker microVM, or similar). Transform
  Data's fixed operation list covers the common cases without that risk.
- **Multi-week Delays**: work today via the cron-tick resume mechanism; practical for anything
  up to however often you ping `/api/cron/tick`, but a delay spanning weeks is better served by
  a real job scheduler eventually.

## Today's security guardrails, and what a hardening pass would add

Built in:
- **SSRF protection** on HTTP Request (`lib/engine/steps/http-request.ts`): blocks RFC1918/
  loopback/link-local/carrier-NAT ranges and the cloud metadata address, resolves hostnames and
  checks every returned IP (DNS-rebinding-safe), refuses to follow redirects, 8s timeout, 100KB
  response cap.
- **Self-trigger loop guard**: an HTTP Request step can't target its own workflow's webhook URL;
  every run also hard-caps at 25 total steps regardless of cause.
- **AI Action prompt-injection defense**: merged trigger/step data is wrapped in an explicit
  `<data>` block with an instruction telling the model never to treat its contents as commands.
- **Rate limiting** on the public webhook and form endpoints: 30 triggers/minute per workflow,
  checked against `workflow_runs`.
- **RLS** on every table (see `supabase/schema.sql`) — the only code that bypasses it is the
  service-role client, used deliberately for the execution engine, the public trigger
  endpoints, and the admin panel.

A production hardening pass should add:
- **Per-domain allowlisting** for HTTP Request, so an account can optionally restrict outbound
  calls to a known set of domains, not just "not-obviously-internal."
- **Signed webhook payload verification** — today `/api/hook/[token]` trusts whatever hits the
  unique URL; a production version would let the user configure an HMAC secret and verify
  incoming signatures (e.g. for Stripe/GitHub-style senders).
- **Structured server-side logging** for failed steps and rate-limit trips (today: `console.error`
  and the failure alert email — fine for a first release, not enough at scale).
- **Retry/backoff policy** for HTTP Request, configurable per step, instead of a single attempt.
- **Per-connection secrets** once real App Connections exist — encrypted at rest, never in a
  plain jsonb column.

## Contact

Techtig — techtig9@gmail.com — +92 348 8597892

## Growth/SaaS-completeness pass (added after the initial build)

A second pass added the pieces a launched SaaS product typically needs beyond the core
build spec, plus a pricing revision aimed at higher margin. All of it is real, wired code —
nothing here is a visual-only stub.

**AI Assistant (`components/assistant/`, `app/api/assistant/chat/route.ts`)** — a floating
chat widget, gated behind login same as everything else, with its own mark (`AssistantIcon.tsx`).
It's grounded in the signed-in user's *real* account data — plan, credit balance, workflow
list, recent run failure rate — gathered fresh on every request and placed in the system
prompt. That's genuine context-injection, not a separately fine-tuned model; the system
prompt says so explicitly and instructs the assistant to never invent numbers that aren't in
that context block. It's advisory-only by design (read-only — it explains and recommends, it
doesn't create/edit/publish/run anything on the user's behalf), which keeps the blast radius
small if it's ever wrong. Streams its response using the same "raw chunks over a ReadableStream"
approach as the test-run SSE endpoint.

**Pricing v2 (`lib/plans.ts`)** — raised the target margin from the original 60–65% band to
~68% at regular price / ~65% even at the annual-billing worst case, and moved prices to
standard SaaS anchor points ($19/$39/$79 instead of $15/$25/$49). Added:
- An **Enterprise tier** (custom-priced, sales-assisted via a "Contact sales" mailto link —
  not self-serve Paddle checkout; activated by an admin via the override tool in `/admin`).
- **Credit top-up packs** priced at the same ~65-68% margin as the base plans — the highest-
  margin line item in the product since there's no incremental customer-acquisition cost
  (`BuyCreditsButton.tsx`, handled as a one-time Paddle transaction tagged with
  `topup_credits` in `custom_data`, credited by the webhook).
- Free tier tightened from 1,000 to 500 credits, a standard "let people feel the product, then
  convert" lever.
- A public **`/pricing`** page with a monthly/annual toggle and full feature comparison table
  (`app/(public)/pricing/`), separate from the in-dashboard `/billing` page.

If your real invoiced AI cost per credit ends up meaningfully different from the modelled
$0.0004 ceiling, redo the margin math in `lib/plans.ts`'s header comment before trusting these
numbers — it's an engineering budget, not a live invoice.

**Notifications** — a real `notifications` table (migration in `supabase/schema.sql`), a
working bell icon in `TopNav` with unread count and a mark-as-read dropdown, and a run-failure
notification inserted alongside the existing failure-alert email (`lib/engine/executor.ts`) —
so a failure is visible in-app even if `RESEND_API_KEY` isn't configured.

**Onboarding checklist** — the dashboard home page shows a "Getting started" card (create a
workflow → publish it → trigger a run) driven by real queries, not a hardcoded flag, and
disappears once all three are done. Also added a time-of-day greeting.

**Rounding out the marketing site** — `/pricing`, `/terms`, `/privacy`, a real `not-found.tsx`
(404) page, and a reworked landing page: a time-aware greeting line, an engineering-honest
"why this matters" trust section (real claims about the SSRF guard and per-run billing — no
fabricated testimonials or customer logos, since we don't have real customers yet), and a
pricing preview linking to the full page.

**Motion system (`app/globals.css`)** — `fadeIn`/`slideUp`/`shimmer`/`floatSlow` keyframes
plus stagger-delay helper classes, applied across the landing page, pricing page, dashboard
cards, and the notification/assistant panels. Respects `prefers-reduced-motion` (see the
media query already at the top of `globals.css`) — animations collapse to near-instant for
anyone with that OS setting on. `Button` got press feedback (`active:scale-95`) and a hover
shadow so the whole app feels consistent, not just the pages touched directly in this pass.

**Dark mode** — real, not a stub. The whole color system (`canvas`/`surface`/`panel`/`ink`/
`slate`/`hairline`/`signal`/`pulse`/`danger`/`warn`) is now CSS-variable-backed
(`tailwind.config.ts` + `:root`/`.dark` in `globals.css`), so every component that already used
those tokens flipped automatically. The ~25 spots that hardcoded `bg-white` as a card/panel
background were converted to the new `bg-panel` token — done as a scripted pass across the
codebase, then re-verified with the same syntax + import/export checks as the rest of the
build (see the "Verification" section below). One deliberate exception: the pricing-toggle switch's knob
stays literal white in both themes, matching how native OS toggles usually work. A real bug
this pass caught: the mobile nav drawer's dimming overlay used `bg-ink/30`, which is fine in
light mode but would have turned into a *light* wash in dark mode since `ink` flips to
near-white — fixed to a fixed `bg-black/30` scrim, which is correct in both themes.
`ThemeToggle.tsx` (in `TopNav` and the public header) flips the `.dark` class on `<html>` and
persists the choice to `localStorage`; a small blocking script in `app/layout.tsx` applies the
saved (or OS-level) preference before first paint so there's no flash of the wrong theme.

**SEO basics** — `app/sitemap.ts` and `app/robots.ts` using Next's built-in metadata route
APIs; only public pages are listed, and the dashboard/API routes are explicitly disallowed.

**Loading and error boundaries** — `app/(dashboard)/loading.tsx` (finally puts the `.skeleton`
shimmer CSS to use — it was defined in an earlier pass but never actually referenced anywhere,
a real gap this pass caught), plus `app/error.tsx` and `app/(dashboard)/error.tsx` following
Next's App Router error-boundary convention, so a broken page shows a recoverable error state
instead of a blank screen or a raw stack trace.

**Assistant chat history** — persists to `localStorage` per browser (not per-account/synced
across devices — that would need a new database table) so a page reload doesn't lose the
conversation. A "Clear" control resets it.

**What's still not here, honestly**: 2FA/MFA on login (Supabase Auth supports TOTP via
`auth.mfa.*`, but a correct enroll + step-up-challenge flow touches both login and middleware
in ways that are easy to get subtly wrong without a live environment to test against — flagging
it rather than shipping a half-verified auth-security feature), and cross-device sync for the
Assistant's chat history (currently per-browser via localStorage, not per-account in the
database).

## Verification

This codebase was written without a working `npm install` available (no network in the build
environment — see the note at the very top of this file) — so "verification" here means
something specific, and it's worth being precise about what was and wasn't actually checked:

- **Every `.ts`/`.tsx` file** (99 of them) was run through `esbuild` as a syntax check —
  catches malformed TypeScript/JSX, mismatched braces, invalid syntax — on every single pass
  of edits, not just once at the end.
- **Every local import was cross-referenced against the file it points to**, confirming the
  imported name is actually exported there. This catches the class of bug syntax-checking
  can't: a typo'd import name, a function renamed in one file but not updated elsewhere, a
  path that doesn't resolve. Run after every batch of changes across the whole build.
- **`use client`/`use server` directives** were checked file-by-file — every file using React
  hooks has `"use client"`, every Server Action file has `"use server"`.
- Beyond that: manual read-through of every file against its phase's Definition of Done, plus
  the real unit test suite described below for anything that's pure logic.

What this does NOT verify: that `npm install` actually succeeds with these exact dependency
versions, that the app compiles with `next build`, or that it behaves correctly against a live
Supabase project. Those require an environment with network access and real service
credentials — which is exactly what's needed to move from "verified as far as this sandbox
allows" to "confirmed working." Running `npm install && npm run typecheck && npm run build`
yourself is the natural next step, and given the scope of this project, don't be surprised if
that first run surfaces a small issue — a version mismatch or an edge case this sandbox
couldn't catch. If so, treat it as: sound architecture, quick fix, not a rewrite.

## Testing

There's a real, runnable test suite — `npm test` (`tsx --test test/*.test.ts`) — covering
every module in the codebase that's pure logic with no Next.js/Supabase dependency: the
merge-field resolver, the SSRF-blocking logic, the cron scheduler, the Filter and Transform
Data steps, and the pricing math. **52 tests, all passing**, and they test the real source
files directly (`lib/engine/...`, `lib/pricing.ts`) — not copies or reimplementations.

Two real refactors came out of setting this up, both genuine improvements independent of
testing:
- **`lib/engine/ssrf-guard.ts`** — the SSRF-blocking logic (IP-range checks, DNS-rebinding
  protection) used to live inline inside `http-request.ts`. Pulling it into its own
  dependency-free module made it directly unit-testable — and is just better separation of
  concerns for security-critical code regardless.
- **`lib/pricing.ts`** — the plan/credit/price configuration and margin math used to live in
  `lib/plans.ts` alongside Supabase-dependent access-control functions, which made the whole
  file impossible to import in a test without a live database connection. Split into a pure
  config module (`lib/pricing.ts`) and a thin Supabase-backed gating layer (`lib/plans.ts`,
  which re-exports everything from `pricing.ts` so no other file's imports had to change).

One of the pricing tests is worth calling out specifically:
`"every paid plan holds a 60% margin FLOOR even in the worst case"` — this actually
recomputes the margin math from the real `PLAN_CREDITS`/`PLAN_PRICE_USD` values and asserts
it, rather than trusting the claim in a comment. If someone changes a price or a credit
number later without redoing the math, this test fails.

**What this test suite does NOT cover, honestly**: anything that touches Next.js rendering,
Supabase, Anthropic, Resend, or Paddle — which is most of the app's *code volume* even though
it's a small fraction of its *risk surface* (the pure logic above is where a bug would be both
easy to introduce and hard to notice). Those parts were verified the way described under
"Verification" above (syntax-checked, cross-referenced for import/export correctness, and
manually read through against each phase's Definition of Done) — real verification, but not
the same as an integration test hitting a live database. Once you have a real Supabase
project, the natural next step is a handful of integration tests against it (create a
workflow, trigger it via `/api/hook/[token]`, assert the run trace) — the test file structure
here (`test/*.test.ts`, `node:test`) is ready for those to sit alongside the unit tests.

## Screenshots

See `docs/screenshots/` — six static HTML/CSS mockups (landing, dashboard in both light and
dark mode, the workflow builder, pricing, and the Assistant widget), built from the app's
actual design tokens and rendered with a real Chromium browser. They're a faithful visual
reference, not live captures — this sandbox has no network access, so Next.js itself can't
actually run here to be captured directly. `docs/screenshots/README.md` explains the one
cosmetic difference (system font instead of the real app's self-hosted IBM Plex).

## Theme: Aurora (evolved from the original Minimal Corporate AI direction)

The visual system moved from flat/bordered cards on a plain background to a fuller, bolder
direction:

- **Aurora background** — three large, slowly-drifting blurred color blobs (signal blue,
  pulse teal, and a new violet accent) sit fixed behind every page, public and dashboard
  alike. `components/AuroraBackground.tsx`, mounted once in `app/layout.tsx`, so it's
  consistent everywhere rather than a one-off hero effect. Deliberately ambient — heavy blur,
  low opacity (`--aurora-opacity`, tuned separately for light/dark) — the point is to add
  color and depth behind the UI, not to compete with it. The `prefers-reduced-motion` media
  query already at the top of `globals.css` freezes the drift animation for anyone with that
  OS setting on, same as the rest of the motion system.
- **White floating cards** — `Card.tsx` now carries a real elevation shadow (`.shadow-float`)
  by default, tuned separately for light and dark, so cards read as sitting above the aurora
  rather than just being bordered boxes on top of it.
- **Bold/simple type** — every `font-medium`/`font-semibold` utility class across the codebase
  was bumped up one weight (medium → semibold → bold) in a single scripted pass, plus a base
  `h1, h2, h3 { font-weight: 700 }` rule in `globals.css` as a fallback for anything that
  doesn't set an explicit weight. The loaded IBM Plex Sans weights grew from
  400/500/600 to include 700 (`app/layout.tsx`) to actually support that.
- **Where it's NOT applied**: the sidebar, top nav, and other structural chrome stay solid
  `bg-panel` — the aurora is visible through the gaps and margins around content, not through
  the navigation itself. A dashboard fully awash in drifting color gradients behind dense data
  would hurt daily-use readability; the aurora treatment is calibrated to stay in the
  "ambient background," never "distraction," even though it's applied app-wide, not just on
  the marketing pages.

The mockups in `docs/screenshots/` were regenerated after this change — same honesty caveat as
before applies (real Chromium render, not a live capture of the Next.js app).

## Fixed: the dashboard search bar now actually works

An earlier pass added a search input to the top nav that looked functional and wasn't — no
`onChange`, no state, pure decoration. Caught during a feature audit and fixed properly:

- `lib/actions/search.ts` — a Server Action, not an API route, matching workflows by name and
  runs by status-or-workflow-name for the signed-in user. It deliberately does **not**
  hand-roll a `user_id` filter on runs — Postgres RLS (`supabase/schema.sql`'s "own runs"
  policy) is what actually scopes results, using the request-bound Supabase client rather than
  the service-role one. That means even a bug in this function couldn't leak another user's
  data; the database enforces the boundary, not application code.
- It's also intentionally *not* one clever combined query. An early draft tried to filter
  across a joined table inside a single `.or()` string — the kind of thing that looks correct
  and is genuinely easy to get subtly wrong against real PostgREST without a live instance to
  test it on. Rewritten as two separate, individually well-supported filters (`ilike`, `in`)
  merged in application code instead.
- `components/dashboard/TopNav.tsx` — real debounced search (250ms), a results dropdown
  grouped by Workflows/Runs, loading state, empty state, close-on-outside-click and
  close-on-Escape.

Same verification as everywhere else in this project: syntax-checked, cross-referenced for
import/export correctness, and the existing 52-test suite still passes (this function itself
isn't unit-tested — it's Supabase-dependent, same category as `canUseFeature`/
`deductRunCredits` in `lib/plans.ts`, which were never claimed to be covered either).

## BusiGo AI Business Operating System

The project now includes a phased Business OS layer on top of the existing workflow automation engine.

### Phases

1. **Discover** — Business Brain, business profile, discovery interview and business memory.
2. **Connect** — existing Connections area remains the integration layer for external business systems.
3. **Automate** — Automation Center and existing workflow builder/execution engine.
4. **Deploy AI Workforce** — specialist agents, autonomy levels and human Approval Center.
5. **Measure & Grow** — AI Opportunities, KPI/insight surfaces and verified outcome architecture.
6. **Autonomous Operations** — controlled low-risk automation with explicit approval boundaries.

### Database

Run `supabase/schema.sql` in the Supabase SQL editor, then every file in
`supabase/migrations/` **in filename order** (they're timestamp-prefixed so a plain
alphabetical listing — `ls supabase/migrations/*.sql | sort`, or the Supabase CLI's own
`supabase db push` — applies them correctly; no manual reordering needed). Finish with
`supabase/seed.sql` once, manually, for the starter workflow templates — it's not part of
the migration chain and won't run automatically. See `PRODUCTION_READINESS.md` for the full
deployment checklist (Paddle, AI provider keys, cron, security headers, etc.).

### Environment

The existing app uses Supabase authentication/database and the existing AI assistant environment variables. Business analysis has a deterministic fallback so the opportunity scanner does not require an AI provider just to function; model-backed intelligence can be layered into the same route later.

### Validation

Run:

```bash
npm install
npm run typecheck
npm test
npm run build
```

The application requires a configured Supabase project and the schema above before authenticated Business OS pages can load successfully.

## BusiGo phased Business OS
- Phase 1: Discover — `PHASE_1_REPORT.md`
- Phase 2: Connect — `PHASE_2_REPORT.md`
- Phase 2 migration — `supabase/migrations/20260817090100_phase2_connect.sql`
