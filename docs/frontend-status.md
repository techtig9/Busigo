# BusiGo Frontend — Status

**Branch:** `claude/busigo-frontend-audit-2p22eo` · **Last updated:** 2026-09-07

A factual record of what the frontend redesign delivered, what it deliberately did not, and
what a reviewer should check next. Companion to `docs/design-decision.md`, which records why
the foundation was chosen.

---

## Verification, as measured

Every number below was produced by running the thing, against a **clean production build**
unless noted.

| Gate | Result |
|---|---|
| `typecheck` | pass, 0 errors |
| `lint` | pass, 0 errors, 0 warnings |
| `test` (unit) | 120 / 120 |
| `e2e` (Playwright, production build) | 28 / 28 · desktop + mobile |
| `qa`, `qa:phase9`, `qa:final`, `qa:ai` | all pass |
| `build` | pass |
| axe serious/critical violations — 10 public routes × 2 themes | **0** (from 28) |
| axe serious/critical violations — dashboard UI via `/dev/*` harnesses × 2 themes | **0** (from 8) |
| Screens on the design system | **all 42 routes** |
| Console errors — 10 public routes × 2 themes | **0** |
| Horizontal overflow — 10 routes × 6 widths (1440/1280/1024/768/390/360) | **0** |
| Non-token colours in `app/` + `components/` | **0** |
| AI provider order | unchanged: `groq → cerebras → openrouter → anthropic` |
| Production CSP | still forbids `eval`; `/dev/*` returns 307 |

Accessibility and contrast were **computed, not eyeballed**: every colour pair was measured
against the surface it actually sits on, and the chart palette was run through the
colour-blindness validator before any chart code was written.

---

## Complete

**Phase 0 — Baseline.** First compile of this codebase in this environment. The `lint` gate
had never actually run (no ESLint config, so `next lint` opened an interactive prompt and
linted nothing); wired it up and fixed all 51 findings it surfaced.

**Phase 1 — Foundation decision.** Recorded in `docs/design-decision.md`. Figma is
authenticated but exposes no design content and the account's tier caps MCP reads at ~20/month
against the 126+ a screen-by-screen pass would need, so the foundation is code-native. Tokens
live in one CSS-variable block so a future Figma extraction can merge in without touching a
component.

**Phase 2 — Tokens and primitives.** 11 → 30+ semantic tokens across both themes, violet
brand, Inter, radius/shadow/motion scales, Aurora scoped out of the dashboard, ~20 Radix-backed
primitives, and a `/dev/design-system` gallery.

**Phase 3 — Application shell.** Grouped collapsible sidebar (cookie-persisted so it renders
correctly server-side), ⌘K command palette on cmdk, Radix-backed top bar menus, breadcrumbs,
`PageHeader`, mobile bottom nav, skip link, and one canonical container width.

**Phase 4 — Motion.** Duration/easing tokens, Signal Pulse bound to real execution state,
Radix enter/exit animations. Every animation verified under `prefers-reduced-motion`; Signal
Pulse degrades to a static cyan state indicator so the meaning survives without the motion.

**Phase 6 — Workflow Builder.** Three-panel layout, node library rail, undo/redo (whole-
definition snapshots, ⌘Z / ⇧⌘Z), debounced autosave with a live indicator and a
`beforeunload` guard, ⌘S, collapsible test console, trigger/version drawers, copy/paste
(⌘C / ⌘V, copying only edges whose both ends are in the selection), shift-drag multi-select,
and a breadth-first auto-layout that parks unreachable fragments rather than dropping them.

**Phase 7 — Copilot and AI Studio.** Copilot is a docked, non-modal complementary landmark
with an `aria-live` region for streamed replies. AI Studio gained the spec's tabs, with the
page still a Server Component.

**Phase 5 — Screens.** All 42 routes are on the design system. Rebuilt to their specified
layouts: Command Center, Opportunities, Approvals, Runs, Run detail, Workflows,
Agent Orchestration, Workforce (agent cards with a detail drawer), Insights (real charts from
real run and KPI data), Business Brain (tabbed, with a completeness score) and Settings
(tabbed, with API keys omitted rather than shown disabled for non-Security-Admins).

**Phase 8 — Onboarding, landing and SEO.** A six-step resumable onboarding wizard at
`/onboarding` whose every step performs its real action and whose completion is derived from
real state — a business row, a live connection, a published workflow — never from "user
clicked Next". Landing page rebuilt to all twelve specified sections, with metadataBase, Open
Graph, canonical and JSON-LD generated from the same source the visible FAQ renders. No
fabricated logos, testimonials, statistics, certifications or ratings markup.

**Phase 9 — Accessibility and responsive.** 28 → 0 serious/critical violations. See the
fill/ink token split below.

**Phase 10 — QA.** The table above, plus a committed Playwright suite (`npm run e2e`) that
runs against a production build rather than the dev server — dev mode's eval-based source maps
and React Refresh behave differently under this app's CSP, and a dev-server suite would have
missed the `/login` hydration failure entirely.

---

## Not complete

Two items remain, both requiring infrastructure this environment does not have.

### Signed-in E2E journeys

`e2e/public.spec.ts` covers every route reachable without a session — 28 tests, desktop and
mobile. The specification's signed-in journeys (signup → workspace → onboarding → connect →
Business Brain → AI analysis → workflow → simulate → publish → trigger → inspect run →
failure/retry → approval → AI failover → billing → invite → role restriction → MFA → data
export → workspace isolation) are **specified but not implemented**, because they cannot pass
without a live Supabase project, seeded credentials and provider keys. `e2e/README.md` lists
exactly what to set and how to split the specs once staging exists.

Writing them against no backend would produce tests that skip, or assert nothing — worse than
their absence, because a green suite would then mean less than it does now.

### Dashboard screens rendering against real data

Every dashboard route is a Server Component behind Supabase auth. They are verified by
typecheck, lint, production build, data-contract review, and — for the shell, design system
and builder — by real browser interaction through the `/dev/*` harnesses. They have **not**
been seen rendering real rows from a real database.

### Out of scope by design

- **New workflow node types** (Branch, Merge, Loop, Wait-for-Event, Error Handler, Human
  Approval, App Action). The executor implements seven step types; rendering nodes that cannot
  run is exactly the mock behaviour the spec forbids. This is an engine change, not a frontend
  one.
- **Figma-derived visuals.** See `design-decision.md` §1.

## Notable defects found and fixed

Each was found by running the application, not by the gates — all of them passed typecheck,
lint and build.

| Defect | Consequence |
|---|---|
| `getBusinessContext(user.id)` on the Command Center where every other call site passes `workspace.id` | The page's agents, opportunities, approvals and score panels were permanently empty |
| Nested `<form>` in `LoginForm` | The HTML parser drops the inner form, so `/login` failed hydration in production (React #418 ×8, #423) |
| CSP omitted `'unsafe-eval'`, which Next.js dev mode requires | **Every button, menu, toggle and shortcut in the app was dead under `npm run dev`** |
| `Button`/`IconButton` were not `forwardRef` | Every Radix `asChild` trigger silently dropped its ref, breaking tooltip/menu positioning and focus restoration |
| Loading `Button` used `invisible` (`visibility:hidden`) | A busy button had **no accessible name** at all |
| `graphToFlow` passed through a node with no `position` | React Flow dereferences `position.x` unguarded — one missing value took the whole builder page down |
| 20 label/control pairs never programmatically associated | Screen readers announced unnamed fields |
| `text-danger` (#E55353) at 3.69:1, `muted` at 3.02:1, and 6 more failing pairs | Text below WCAG AA across both themes |
| No favicon existed (no `public/`, no icon) | Every page load 404'd |
| `agent-orchestration` styled with shadcn tokens absent from this config | Text rendered unstyled; bare `border`/`bg-black` did not adapt to dark mode |

### The fill/ink token split

The single most reusable outcome of the accessibility pass. A colour cannot serve as both a
vivid fill and legible text: `#E55353` is 3.69:1 as text on white, and `#16A36B` is 2.98:1 on
its own soft ground. Backgrounds keep the vivid hue; `-ink` steps carry text; `-strong` steps
carry solid fills under white text. Measured worst cases:

```
signal-ink   5.57:1     success-ink  4.93:1     warn-ink    4.90:1
danger-strong 6.51:1    pulse-ink    5.42:1     info-ink    5.30:1
slate        4.82:1     muted        4.86:1
```

### Why the Command Center chart is one violet series

The obvious design — stacked success/failed bars — was rejected on measurement, not taste. The
palette validator scores success green against danger red at **ΔE 5.1 under deuteranopia**,
below the 6.0 floor: the textbook red-green-colourblind failure, and no amount of labelling
rescues an adjacent pair under the floor. Plotting the success *rate* as one violet series
answers the same question with no adjacency to fail. Light `#6D4AFF` and dark `#8B6EFF` were
validated separately against the real panel surfaces.

---

## What a reviewer should do next

1. **Point a staging Supabase project at this branch.** Every dashboard screen is a Server
   Component behind auth, so they were verified by typecheck, lint, build and data-contract
   review — *not* by watching them render with real rows. The `/dev/*` harnesses cover the
   shell, the design system and the builder, but not the data screens.
2. **Decide on the Next.js upgrade.** `next@14.2.18` carries 30 advisories, one critical, and
   several hit this app's exact architecture — middleware authorization bypass (this app's auth
   and MFA boundary) and SSRF in Server Actions (nearly everything here). `npm audit fix
   --force` wants `next@16`, a two-major breaking upgrade. It should be its own workstream, not
   folded into a redesign.
3. **`/workflows/[id]` is 70 kB / 174 kB First Load** — React Flow loads eagerly. It is the
   concrete target for the spec's "dynamic import for heavy canvas/charts".
4. Read `docs/design-decision.md` for the reuse / redesign / reject boundaries.
