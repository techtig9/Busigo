# End-to-end tests

```bash
npm run build      # the suite runs against a production build, not the dev server
npm run e2e
```

`playwright.config.ts` starts `next start` itself, so `npm run e2e` is the whole command
locally. Point `PLAYWRIGHT_BASE_URL` at a deployment to test that instead.

## Why a production build

Dev mode compiles with eval-based source maps and React Refresh. Those behave differently
under this app's strict CSP and change hydration timing, so a dev-server suite would verify
something no user ever runs — and would have missed the `/login` hydration failure that only
appeared in a production build.

## What is covered here

`public.spec.ts` covers every route reachable without a Supabase session:

- all 10 public routes return 200, render exactly one `h1`, produce **zero** console errors and
  **zero** horizontal overflow, on desktop and mobile viewports
- the landing page's JSON-LD parses and carries Organization, SoftwareApplication and FAQPage —
  and carries **no** `aggregateRating` or `Review`, which the spec forbids fabricating
- theme preference is applied before first paint, not after hydration
- every auth field has a programmatically associated label
- `/login` has no nested `<form>` (the defect that broke hydration in production)

## What is NOT covered, and what it needs

The specification's signed-in journeys — signup → workspace → onboarding → connect an app →
Business Brain → AI analysis → workflow → simulate → publish → trigger → inspect run →
failure/retry → approval → AI failover → billing → invite → role restriction → MFA → data
export → workspace isolation — are **not** implemented here, because they cannot pass without
live infrastructure. They need:

| Requirement | Why |
|---|---|
| A Supabase project with the migrations applied | Every dashboard route is auth-gated and RLS-scoped |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Session creation and test-data seeding |
| A seeded test account, ideally created via the service-role key in `globalSetup` | So the suite does not depend on signup email delivery |
| `GROQ_API_KEY` (at minimum) | AI-action steps and the failover path |
| Paddle sandbox credentials | Billing journeys |
| An SMTP/Resend sandbox | Email-step assertions |

Writing those specs against no backend would produce tests that are skipped or, worse, assert
nothing — which is why they are described here rather than committed as passing stubs.

Once a staging project exists, the natural split is one spec per journey
(`auth.spec.ts`, `workflow.spec.ts`, `approvals.spec.ts`, `billing.spec.ts`,
`isolation.spec.ts`) with a shared `globalSetup` that provisions and tears down a workspace.

## Browsers

The sandboxed image ships Chromium at `/opt/pw-browsers/chromium` and the config points at it,
so **do not run `playwright install`**. Override with `PLAYWRIGHT_CHROMIUM` if your environment
puts it elsewhere.
