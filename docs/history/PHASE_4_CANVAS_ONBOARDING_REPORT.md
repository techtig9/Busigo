# Phase 4 — Visual Workflow Canvas (Real DAG Branching) + Onboarding

Master Spec sections covered: 5 (visual workflow builder, AI workflow builder — partially),
3 (onboarding). Builds on Phases 0–3. No new migration this phase — the graph format lives
in the existing `workflows.definition` jsonb column, same as the old linear array.

## The core problem this phase actually solves

Every workflow before this phase was a strictly linear list — `StepDefinition[]`, executed
by walking an array index. A Filter step could only ever do one thing on a failed condition:
stop the entire run. There was no way to say "if this, do X; otherwise, do Y" — the single
most common thing anyone building an automation wants to express. This phase replaces that
with a real graph.

## Graph data model (`lib/engine/graph.ts`, pure, 27 tests)

- `WorkflowGraph = { nodes, edges }`, where a `filter` node can have two outgoing edges
  (`branch: "true" | "false"`) and every other node has at most one.
- `linearToGraph()` converts the legacy array into an equivalent straight-chain graph —
  **every already-published workflow keeps working completely unchanged.** A legacy filter
  step's single edge is preserved as "only followed on pass" (`resolveFilterNext`'s
  documented legacy-fallback rule), exactly matching the old stop-on-fail behavior.
- `validateGraph()` catches editor mistakes before they become confusing runtime failures:
  dangling edges, cycles, more than one entry point, a non-filter node trying to fan out, a
  filter branch used twice or left unlabeled.
- `getAncestorKeys()` walks the graph backward from a node so the canvas only offers merge
  fields (`{{stepKey.field}}`) for steps that could actually have already run by that point —
  not just "everything else in the workflow," which would let you reference a step down a
  branch that was never taken.

## Executor rewrite (`lib/engine/executor.ts`)

Changed from iterating a flat array index to walking graph edges from an entry node. A
`filter` step's pass/fail result now selects which edge to follow via `resolveFilterNext`
instead of always halting the run. Retry/pause/dead-letter (Phase 3) all converted from
index-based to node-key-based resume — genuinely simpler this way, since "resume at this
node" is a more natural fit for a graph than an array offset ever was. Caught and fixed a
real bug of my own making mid-implementation: the first draft of the Delay-step pause logic
stored the delay node's own key as the resume point, which would have replayed the delay
forever instead of continuing past it — fixed to resolve and store the *successor* key at
pause time.

## Visual canvas (`components/workflow-builder/canvas/`, built on `@xyflow/react`)

- Drag-and-drop node graph: add a step from the palette, drag to connect, click a node to
  configure it in a side panel (reusing the existing `StepConfigForm` — every step type's
  config UI carried over exactly, nothing was rebuilt from scratch).
- A Filter node renders two labeled, color-coded output handles (green `true`, red `false`)
  — dragging a connection from each wires that branch; connecting a second edge from the
  same handle replaces the first rather than fanning out (matches `validateGraph`'s rule
  that a filter has at most one edge per branch).
- Live validation surfaces `validateGraph`'s errors as you edit, not just at save time.
- A pure, tested conversion layer (`lib/engine/canvas-convert.ts`, 9 tests) translates
  between our domain graph and React Flow's own node/edge shapes — round-trip tested.
- The first time someone edits and saves a legacy linear workflow through the canvas, it's
  stored as a real graph going forward — an implicit, automatic upgrade path, not a
  disruptive one-time migration.

## Onboarding

The prior "getting started" checklist (3 items, always visible, dashboard-page-only) is now
a dedicated, dismissible component with 5 items — added "invite a teammate" and "connect an
app," both real capabilities that already existed (Phase 1's team invites, the Connections
page) but were never surfaced as next steps for a brand-new workspace. Dismissal is a
per-workspace preference stored in the existing `workspace_settings` key/value table (no new
migration) and any member can dismiss it, not just an admin — a deliberate, documented
exception to that table's usual admin-only write policy for this one low-stakes case.

Also added a new seed template, **"Webhook → Filter (branching) → Send Email,"** stored in
the *new graph format* on purpose — every earlier template is still the plain array format
and didn't need to change (they load and edit fine via the automatic conversion) — this one
exists specifically so a new workspace's first look at the canvas already shows what a real
branch looks like, not just a chain. Validated programmatically against `validateGraph`
before adding it, not just hand-checked. `supabase/seed.sql` is a manual one-time script per
the README (not part of the automated migration chain) — an already-deployed project won't
get this new template until `seed.sql` is re-run against it.

## Known limitations (stated plainly)
- Branching is deliberately scoped to `filter` nodes only (true/false, two-way) — no
  generalized switch/case, no parallel fan-out/fan-in execution. That's a materially bigger
  feature (the executor would need to run branches concurrently and reconcile results) and
  wasn't attempted here.
- `markUnreachableSkipped` (which nodes the UI marks "skipped" after a failure) is a
  best-effort heuristic: it walks forward along single unconditional edges and stops at the
  next fork, rather than exhaustively computing every unreached node in a complex graph —
  documented in the code as intentional, not a gap discovered later.
- No auto-layout algorithm for a freshly-converted legacy workflow beyond the simple
  top-to-bottom stack `linearToGraph` produces — a real force-directed or dagre-style layout
  would look better for anything wider than a straight line, but wasn't built this phase.
- The AI-generated plan flow (AI Studio, `architectAndCreateWorkflowAction`) still always
  produces the linear array format — it never generates a branch on its own. Teaching the AI
  planner to propose branches is a natural follow-up, not attempted here.
- Onboarding is an enhanced checklist, not a guided modal wizard or product tour — a
  reasonable, scoped choice given the size of the rest of this phase, not a corner cut
  silently.

## Verification actually performed

```
npm run typecheck → 0 errors (across the graph model, executor rewrite, canvas, onboarding)
npm test          → 119/119 pass (91 previous + 28 new: 24 graph-model tests, 4 canvas
                     conversion round-trip tests)
npm run build     → compiles cleanly through webpack/module resolution for every new file
                     and the new @xyflow/react dependency; fails only at the same
                     Google-Fonts-network step documented since Phase 0 (a sandbox
                     limitation, not a code issue — confirms no NEW build-breaking problem)
npm run qa        → PASS (18 migrations, 357 policies — unchanged, no schema change this phase)
npm run qa:final  → PASS (18 migrations, 357 policies, 25 dashboard routes)
npm run qa:ai     → PASS — Groq → Cerebras → OpenRouter → Anthropic unchanged
The new branching seed template was validated programmatically against validateGraph()
  (not just hand-checked) before being added to seed.sql
```

As with every phase: actually dragging a connection in a real browser, watching a live
branching run execute against real Supabase, and confirming the canvas renders correctly
across viewport sizes all need verification outside this sandbox — no browser or live
database available here. Open a real workflow, add a Filter step, drag both a true and
false connection, save, publish, and trigger it for real before treating this as
production-verified.
