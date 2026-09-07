# Deploying BusiGo to Vercel

This is the exact procedure for standing up a BusiGo deployment on Vercel, and — just as
importantly — what each stage of configuration actually gets you. The app is built to
degrade in defined stages rather than either "works" or "500s", so a half-configured
deployment is still a useful one.

## What you get at each level of configuration

| Environment configured | What works | What doesn't |
| --- | --- | --- |
| **Nothing at all** | The whole public site: `/`, `/pricing`, `/about`, `/help`, `/login`, `/signup`, `/terms`, `/privacy` — all return 200 with the full design system, dark mode, and responsive layout. | Every authenticated route (`/dashboard`, `/workflows`, `/runs`, `/settings`, `/admin`, …) redirects to `/login?unconfigured=1`, and the login page says plainly that the deployment has no database attached. Nothing behind the login is ever served. |
| **+ Supabase** | Sign-up, sign-in, workspaces, workflows, runs, connections, settings, admin — the whole product. | AI Actions fail at execution (no provider key). Billing shows plans but checkout can't open. Transactional email is skipped. |
| **+ an AI provider key** | AI Actions, AI Studio, the copilot, and the opportunity scanner. | Billing, email. |
| **+ Paddle & Resend** | Subscription checkout, credit top-ups, webhook-driven plan changes, and transactional email. | — |

This staging is deliberate and it is **fail-closed**: the absence of credentials never
widens access, it only narrows what is reachable. See `middleware.ts` for the guard.

## Build-time vs runtime variables

This distinction matters on Vercel, because adding a variable after a build does not
retroactively change that build.

**Baked in at build time — you must redeploy after changing these:**

- Every `NEXT_PUBLIC_*` variable. Next.js inlines these into the client bundle.
- `NEXT_PUBLIC_SUPABASE_URL` specifically has a second, less obvious build-time role:
  `next.config.js` reads it to compose the `connect-src` directive of the Content
  Security Policy. If it is absent at build time, the CSP will not permit the browser to
  reach Supabase at all — sign-in will fail with a CSP violation in the console rather
  than an auth error, even if the variable is present at runtime. **Set this before the
  first build, not after.**

**Read at runtime — a change takes effect on the next request, no rebuild needed:**

- `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`,
  `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `CRON_SECRET`,
  `BUSIGO_TOKEN_ENCRYPTION_KEY`, `OAUTH_STATE_SECRET`, and every OAuth
  `*_CLIENT_ID` / `*_CLIENT_SECRET`.

`.env.example` is the authoritative list of every variable the code reads.

## Procedure

1. **Create the project.** Import `techtig9/Busigo` in Vercel. Framework preset is
   detected as Next.js; the defaults (`npm run build`, `.next`) are correct — this repo
   needs no `vercel.json`.
2. **Create the Supabase project** and run, in order: `supabase/schema.sql`, then every
   file in `supabase/migrations/` in filename order, then `supabase/seed.sql` once.
   `PRODUCTION_READINESS.md` has the full checklist.
3. **Add environment variables** to the Vercel project, at minimum
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY`. Add the rest as you enable each capability.
4. **Set `NEXT_PUBLIC_SITE_URL`** to the deployment's real origin. OAuth callbacks and
   the emails Resend sends build absolute URLs from it; left blank, links in email point
   nowhere.
5. **Redeploy** so the `NEXT_PUBLIC_*` values and the CSP are baked in.
6. **Point Supabase Auth's redirect allowlist** at the same origin, or email
   confirmation links will bounce.
7. **Point the Paddle webhook** at `https://<origin>/api/webhooks/paddle` and set
   `PADDLE_WEBHOOK_SECRET` to the signing secret Paddle shows you. The endpoint verifies
   every signature and rejects unsigned calls.

## Two Vercel settings that will confuse you if you don't know about them

**Deployment Protection (Vercel Authentication).** If this is on, every deployment URL —
including production — shows a Vercel login wall to anyone who is not a member of the
Vercel team. The deployment is fine; the site is simply gated in front of Next.js. Turn
it off under *Project → Settings → Deployment Protection* to share a link publicly.

**A stale git link survives a repository being recreated.** Vercel stores the link to a
repository by its numeric GitHub id, not by `owner/name`. Delete a GitHub repo and push a
new one under the same name and it gets a *new* id, so the Vercel project keeps pointing
at an id that no longer exists. The symptom is silent: commits land on `main`, GitHub
shows them, and Vercel never builds — no error, no failed deployment, nothing in the
activity log. Nothing about the commit is wrong.

That is what happened to the original `busigo` project here: it is linked to repository id
`1323653363`, while `techtig9/Busigo` is now id `1350472673`.

Creating a fresh project against the current repository is **not** sufficient on its own,
and it is worth knowing why. `busigo-preview` was created against `techtig9/Busigo` and
built correctly on creation, with full commit metadata — so Vercel can *read* the
repository through the account's OAuth token. But two subsequent pushes to `main` produced
no build on either project. Read access and webhook delivery are separate things: the
first comes from OAuth, the second requires the **Vercel GitHub App to be installed on the
repository**. A recreated repository does not inherit the old one's app installation, so
no project linked to it receives push events, whatever its git link says.

The remedy is to grant the Vercel GitHub App access to `techtig9/Busigo` — GitHub
*Settings → Applications → Vercel → Configure*, or Vercel *Project → Settings → Git →
Connect* — after which pushes deploy normally. Until then, deployments must be created
explicitly (the Vercel dashboard's **Redeploy**, or `vercel --prod` from a checkout);
`git push` alone will do nothing.

**Paused projects** produce the same silent symptom for a different reason: a paused
project keeps serving its last deployment but stops building on push. Check both before
looking for anything wrong with the commit.

## Verifying a deployment

```bash
# Public pages must be 200 even with nothing configured.
for p in / /pricing /about /help /login /signup /terms /privacy; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' "https://<origin>$p")"
done

# Authenticated routes must redirect, never render, when signed out.
for p in /dashboard /workflows /runs /settings /admin; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' "https://<origin>$p")"
done
```

Expect `200` for the first group and `307` for the second. A `500` anywhere in the first
group means a build-time variable is missing; a `200` anywhere in the second means the
auth guard is not running, which is a security problem, not a cosmetic one.

## Live reference deployment

`busigo-preview` (project `prj_SYyuqDHs2daIXODH79EZoJ4y7tSF`) is built from `main` and
runs with **no environment variables at all**, on purpose — it is the continuously
verified proof that the "nothing configured" row of the table above behaves as described.

- https://busigo-preview.vercel.app

It does not yet rebuild on push, for the GitHub App reason above; it currently serves
`d9753c5`. Once the app is installed on the repository it will track `main` on its own.

Verified on the live deployment: `/dashboard` serves the login page with the
"no database connected" notice and `x-matched-path: /login`, so the auth guard runs in
production and not just locally. The response carries the full security header set —
`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` — and the
production CSP contains no `'unsafe-eval'`. Its `connect-src` is bare `'self'`, which is
the build-time `NEXT_PUBLIC_SUPABASE_URL` behaviour described above, visible in the wild.
