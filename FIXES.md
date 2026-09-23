# FIXES — phases 1–5

Branch `release/clean`, from `main` @ 9e6915a.

---

## 1. Fixed

### P0 — a customer paid and was recorded as free

`app/api/webhooks/paddle/route.ts` held `PRICE_TO_PLAN` as an object with every entry
commented out, and looked up `PRICE_TO_PLAN[priceId] || "free"`. Every
`subscription.created` and `subscription.updated` therefore wrote `plan: "free"` with
free-tier credits. The bug was invisible until the first real payment.

The price IDs already existed in the environment — the checkout buttons read
`NEXT_PUBLIC_PADDLE_PRICE_{STARTER,GROWTH,PRO}[_YEARLY]`. The map is now derived from those
same variables, so the side that opens the checkout cannot disagree with the side that grants
the plan. An unrecognised price returns `null` and leaves the plan untouched — never "free",
which took paid access away from someone who had just paid.

### P0 — forgeable billing webhooks when the secret was unset

Signature verification fell back to an empty HMAC key. HMAC with an empty key is perfectly
computable, so on any deployment missing `PADDLE_WEBHOOK_SECRET` anyone could sign their own
`subscription.updated` and grant themselves Pro. It now refuses outright.

### P1 — billing webhooks were not idempotent

Paddle retries until it gets a 2xx and can redeliver after one. A retried
`transaction.completed` inserted a duplicate payment row and granted a credit top-up again, at
our cost. Event ids are now claimed under a primary key *before* the work, so a replay is a
no-op and a mid-processing failure drops the event rather than applying it twice — the safe
direction for money.

### P1 — credits silently refilled, and top-ups lost

`subscription.updated` reset `credits_remaining` to the full plan allowance on every event,
including ones with nothing to do with entitlement: a customer who had spent 90% of their
month's credits got them all back by updating their card. Credits now reset only when the plan
actually changes. Separately, top-ups were read-modify-write in application code, so two
transactions landing together lost one; they now go through an atomic SQL increment.

### P1 — every absolute URL the server built was wrong when `NEXT_PUBLIC_SITE_URL` was unset

Two different broken fallbacks:

- OAuth used `|| "http://localhost:3000"`, so the authorization `redirect_uri` and all three
  post-OAuth redirects pointed at the user's own machine. Connecting Google, Slack, HubSpot,
  Notion or Airtable could not complete.
- Auth and invites used `|| ""`, producing **relative** URLs. Supabase requires an absolute
  redirect and a relative href in an email is not a link, so signup confirmation, password
  reset and workspace invitations all failed silently. **This was not in the audit** — it
  turned up while fixing the localhost case.

Both now go through one helper preferring `NEXT_PUBLIC_SITE_URL`, then the forwarded host and
protocol, then the request's own origin.

### P1 — non-null assertions on environment variables

`process.env.X!` is a lie to the type checker: at runtime the value is `undefined`, is handed
to the Supabase constructor, and fails inside the library without naming the missing variable.
Server callers now use a helper that names it. The browser client deliberately does **not**
use that helper — Next.js inlines `process.env.NEXT_PUBLIC_*` by textual substitution and a
dynamic lookup evaluates to `undefined` in a browser — and has its own explicit check.

### P2 — four surfaces reported success that had not happened

- `AgentControls` — no pending state and no error surface; a failed permission save looked
  identical to a successful one.
- `Topbar` — notifications marked read optimistically with no rollback; a failed write still
  emptied the badge while the database disagreed.
- `ChatWidget` — never checked `res.ok`, so a failed request's JSON error body was streamed
  into the transcript as the assistant replying `{"error":"..."}`.
- `PublicFormClient` — the one screen a customer's own visitors see, built outside the design
  system with labels that had no `htmlFor` and controls that had no `id`: clicking a label did
  nothing and screen readers announced every control unlabelled.

### Design (Phase 3)

Navy primary with a **brand-only** orange accent, a Sora display face, a `clamp()` fluid type
scale, a 9-step neutral ramp in both themes, and an animated hero workflow pipeline.

### Repository (Phase 4)

23 phase reports archived to `docs/history/`; one orphan component and two unused packages
removed; `.gitignore` widened to `.env.*`, `dist`, `out`, `.vercel`, `*.zip`; `engines` added;
README rewritten; `docs/DEPLOY_VERCEL.md` written.

---

## 2. Not fixed, and why

| Item | Why |
| --- | --- |
| Rate limiting on auth and AI endpoints | A Phase 7 deliverable by the spec's own text ("rate-limited auth endpoints", "per-user and per-plan rate limits"). Building it in Phase 2 and again in Phase 7 is waste. **Still outstanding — unlimited credential attempts and unlimited paid AI calls.** |
| Account deletion and data export | Likewise assigned to Phase 7 ("account deletion and data export"). |
| `warn` amber vs `danger` red separate by ΔE 4.73, under the 6.0 floor | Pre-existing. Every status already pairs its colour with a distinct icon and the status text (`StatusBadge`), so hue is redundant and WCAG 1.4.1 holds. Churning the status palette is out of scope for a re-palette; recorded rather than silently changed. |
| `running` cyan vs `info` blue separate by ΔE 1.05 | Same reasoning. |
| CSP still carries `'unsafe-inline'` for scripts | Next.js App Router injects inline hydration and RSC payload scripts. A nonce-based CSP needs a per-request nonce generated in middleware and threaded through every script tag — a larger, riskier change than this pass. Documented in `PRODUCTION_READINESS.md` rather than shipped as if it were a strict CSP. |

---

## 3. Design decisions

Full rationale in `docs/design-decision.md`. The one that changed the shape of the work:

**Orange could not become the accent token as the spec's direction implies, because `pulse`
is not decorative.** `statusTone()` maps `running`/`in_progress` to it, directly beside `warn`
for `waiting` and `danger` for `failed`. Measured against those:

| pair | normal | deutan | protan | tritan |
| --- | --- | --- | --- | --- |
| orange vs warn amber | 10.94 | 3.01 | **1.84** | 6.26 |
| orange vs danger red | 10.09 | 6.51 | 7.03 | **3.68** |

Against a floor of 6.0. Recolouring `pulse` would have made a running workflow and a waiting
one the same colour for a protanope, on the screen this product exists to show. So the roles
split: `signal*` is navy (the primary), a new `accent*` family is orange and brand-only, and
`pulse` stays cyan. `accent*` is deliberately absent from the `Tone` union so it cannot become
a status by accident.

`accent-strong` `#B93F08` exists because the brand orange `#F97316` under white text is 2.80:1
and fails AA.

---

## 4. MANUAL ACTIONS FOR ME

### New migration — apply in this order, after the existing chain

```
supabase/migrations/20260924090000_billing_webhook_idempotency.sql
```

Creates `billing_webhook_events` (webhook idempotency ledger, RLS enabled with no policies —
service-role only, by design) and `increment_subscription_credits(uuid, integer)`, a
`SECURITY DEFINER` function with `EXECUTE` revoked from `public`, `anon` and `authenticated`
so only the service-role caller can reach it. Idempotent; safe to re-run.

### Environment variables

No new variables. Two changed in significance:

- **`NEXT_PUBLIC_PADDLE_PRICE_*` are now load-bearing on the server too.** They were only read
  by the checkout buttons; the webhook's price-to-plan map is now derived from them. A price
  not listed here opens no checkout **and** grants no plan. Set all six before taking a
  payment.
- **`PADDLE_WEBHOOK_SECRET` is now mandatory for the webhook to function at all.** It no
  longer falls back to an empty key. If billing is live and this is unset, every webhook is
  rejected with 401.
- **`PADDLE_API_KEY` removed** from `.env.example` — no code path read it.

### Auth redirect URLs

Set `NEXT_PUBLIC_SITE_URL` to the deployment's real origin, then add that origin to
**Supabase → Auth → URL Configuration** redirect allowlist. Without it, email confirmation and
password-reset links bounce. An OAuth `redirect_uri` must match the value registered with each
provider exactly, so pin this before enabling any app connection.

### Vercel settings

Framework preset Next.js, root directory `./`, build command `npm run build`. No `vercel.json`
needed. Full table and the required-variable list in `docs/DEPLOY_VERCEL.md`.

### Keys to rotate

**None.** Every object in git history was scanned for credential patterns and for any
committed `.env` file; nothing was found, so no rotation is needed and no history rewrite was
performed.

---

## 5. Five-minute test checklist

1. **Unconfigured deploy fails closed.** With no env vars, `/`, `/pricing`, `/about`, `/help`,
   `/login`, `/signup`, `/terms`, `/privacy` return 200; `/dashboard`, `/workflows`, `/runs`,
   `/settings`, `/admin` return 307 to `/login?unconfigured=1`. A 200 in the second group is a
   security problem, not a cosmetic one.
2. **Theme.** Toggle dark mode, reload. It holds, with no flash of the wrong theme on first
   paint. Navy primary and orange CTA both legible in each.
3. **Hero pipeline.** Animates on the landing page. Enable "reduce motion" in the OS and
   reload — it renders as a static, fully-lit diagram, not a frozen half-drawn one.
4. **Public form.** Open a published form's public URL. Click a field's *label*: focus moves
   to the control. Submit twice quickly: the button disables after the first.
5. **Paddle.** With price IDs set, complete a sandbox checkout and confirm the workspace lands
   on the paid plan, not free. Then redeliver the same event from the Paddle dashboard and
   confirm credits do **not** increase a second time.
6. **Invite.** Send a workspace invitation and check the emailed link is absolute and opens
   `/invite/<token>`, not a relative path.
