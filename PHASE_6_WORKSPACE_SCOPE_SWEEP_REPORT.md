# Phase 6 — Finishing the Workspace-Scoping Sweep

Builds on Phases 0–5. This round: convert the remaining action files and their corresponding
read-side pages from `user_id` to `workspace_id`, closing out the "not yet converted" list
carried since Phase 1.

## What was converted

**Action files** (11): `business-os.ts`, `workforce.ts`, `autonomous-ops.ts`, `connect.ts`,
`connections.ts` (the one query that was workspace-scoped already), `measure-grow.ts`,
`security-governance.ts`, `marketplace.ts`, `search.ts`, `admin.ts`, and `advanced-growth.ts`
(finished — Phase 2 had only converted its AI Gateway call, not the underlying queries).
`notifications.ts` was reviewed and deliberately kept per-user, with a comment explaining why
(a failure notification shouldn't blast every teammate).

**Read-side pages** (12): `business-brain`, `opportunities`, `approvals`, `insights`,
`workforce`, `growth`, `growth-engine`, `marketplace`, `connect`, `security-governance`,
`autonomous-ops`, `scale-reliability`, `business-intelligence`, and the individual run detail
page (`runs/[workflowId]/[runId]`) — found during the sweep, not on the original list, but
the same gap: it still checked `workflows.user_id` instead of `workspace_id`. The shared
`getBusinessContext()` helper (used by 6 of these pages) was converted once, at the source.

**Migration** (`phase21`): six new workspace-scoped unique indexes
(`businesses`, `business_discovery_answers`, `ai_agents`, `integration_accounts`,
`autonomy_policies`, `marketplace_installations`) — required before any of the converted
upserts could work, since a workspace's Business Brain profile, AI Workforce roster, and
similar shared resources needed a real `unique(workspace_id, ...)` constraint to upsert
against, not just an application-level intention.

## Two more real bugs found doing this (same pattern as every prior phase)

- **`search.ts`**: the workflows query still explicitly filtered by `user_id` while the runs
  query correctly relied on RLS — meaning since Phase 1 introduced shared workspace
  workflows, a teammate's search results silently excluded colleagues' workflows in the same
  workspace. Not a security issue (RLS still enforced the right boundary), an incompleteness
  one. Fixed and made the two queries consistent.
- **`admin.ts`**: the subscription override was keyed by `user_id` — but `subscriptions.user_id`
  is just a billing contact since Phase 3, and isn't unique: the same person can be the
  billing contact on both their own personal workspace's subscription and any team workspace
  they created. A platform admin overriding "this user's plan" could have silently updated
  more than one workspace's subscription at once. Rebuilt the admin panel to be
  workspace-centric — a workspaces table (owner, member count, plan, credits, override
  button) as the primary view, with a separate simple user list and payments matched by
  workspace instead of by a nullable, non-unique user reference.

## Verified this phase actually delivers what it claims: shared team data, not per-user silos

Beyond typecheck/tests, directly tested the thing this whole phase is supposed to accomplish
against live Postgres: seeded two different users as members of the *same* workspace, had
each "save" the shared Business Brain profile and "seed" the AI Workforce roster, and
confirmed:
- Both writes land on the *same* row (via the new workspace-scoped unique constraints) —
  a teammate's save updates the shared profile, it doesn't create a duplicate siloed one.
- Both members can read and write it via RLS (member role or above).
- A third party with no membership in that workspace sees zero rows.

This is the actual point of workspace-centric multi-tenancy proven end-to-end for the newly
converted resources, not just "the query now says workspace_id instead of user_id."

## Known limitations (stated plainly)
- `connections.ts`/the `connections` table itself remains `user_id`-scoped — flagged in the
  Phase 5 report as a deliberate, out-of-scope-for-that-phase item; still out of scope here
  too, since converting it touches the OAuth callback flow and integration execution
  (`app/api/integrations/execute`), a larger, riskier piece not attempted this round.
- `agent-orchestration.ts` and `profile.ts` were reviewed and don't need conversion:
  `profile.ts` is inherently per-user (name, avatar — there's no "workspace's name"), and
  `agent-orchestration.ts`'s single query already uses the correct pattern.
- The `scale-reliability` page's dead-letter card is a secondary, lower-detail view of the
  same data the Runs page's "Dead-lettered steps" panel (built properly in Phase 3, with a
  working replay action) already covers — left in place and fixed for consistency, not
  redesigned or removed, since deleting a page wasn't part of this round's scope.

## Verification actually performed

**Database — same live Postgres 16 instance used throughout:**
```
Fresh DB → schema.sql → all 19 migrations in order → 0 errors
Re-running the new migration a second time, including against a DB with real rows in it
  already → 0 errors (idempotent)
Seeded two users as members of the SAME workspace; verified their upserts to businesses and
  ai_agents correctly UPDATE the same shared row rather than creating duplicates
RLS: both workspace members (owner and member role) can read and write the shared data;
  a non-member sees zero rows
```

**Application:**
```
npm run typecheck → 0 errors
npm test          → 119/119 pass (unchanged — this phase converts existing queries, no new
                     pure logic worth isolating into its own tests)
npm run qa        → PASS (19 migrations, 357 unique policies, 9 core routes)
npm run qa:final  → PASS (19 migrations, 357 unique policies, 25 dashboard routes)
npm run qa:ai     → PASS — Groq → Cerebras → OpenRouter → Anthropic unchanged
```

As before: exercising this against real concurrent teammates in a live product — two people
in different browsers editing the same Business Brain profile at once, watching the AI
Workforce roster stay in sync — needs verification against real infrastructure this sandbox
doesn't have access to.
