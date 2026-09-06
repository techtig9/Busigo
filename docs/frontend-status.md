# BusiGo Frontend — Status

**Branch:** `claude/busigo-frontend-audit-2p22eo` · **Last updated:** 2026-09-06

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
| `test` | 120 / 120 |
| `qa`, `qa:phase9`, `qa:final`, `qa:ai` | all pass |
| `build` | pass |
| axe serious/critical violations — 10 public routes × 2 themes | **0** (from 28) |
| axe serious/critical violations — dashboard UI via `/dev/*` harnesses × 2 themes | **0** (from 8) |
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
`beforeunload` guard, ⌘S, collapsible test console, trigger/version drawers.

**Phase 7 — Copilot and AI Studio.** Copilot is a docked, non-modal complementary landmark
with an `aria-live` region for streamed replies. AI Studio gained the spec's tabs, with the
page still a Server Component.

**Phase 8 (partial) — Landing and SEO.** All twelve specified sections, metadataBase, Open
Graph, canonical, and JSON-LD generated from the same source the visible FAQ renders. No
fabricated logos, testimonials, statistics, certifications or ratings markup.

**Phase 9 — Accessibility and responsive.** 28 → 0 serious/critical violations. See the
fill/ink token split below.

**Phase 10 — QA.** The table above.

---

## Not complete

Stated plainly, because these are real gaps rather than oversights.

### Screens on the design system but not architecturally redesigned

Sixteen screens were brought onto the tokens, `PageHeader`, design-system form controls and the
single container width, but still present as stacks of cards rather than the layouts the
specification describes:

> Workforce · Insights · Business Intelligence · Measure & Grow · Advanced Growth ·
> Autonomous Ops · Automation Center · Marketplace · Connect & Data · Connections · Forms ·
> Security & Governance · Scale & Reliability · Admin · Profile · Business Brain

They are consistent and accessible; they are not yet the agent-cards-with-detail-tabs,
three-panel Automation Center, or tabbed Business Brain the spec asks for. `TrendChart` exists
and is used on the Command Center, but Insights, Business Intelligence and Growth do not yet
plot anything.

### Not started

- **Onboarding wizard** (spec §3, §5). Still the five-item dismissible checklist; the
  eleven-step resumable flow with a completion score is not built. `workspace_settings` already
  has somewhere to persist progress.
- **Settings tabs** (spec §27). Settings is one column of cards, not the eight-tab structure.
- **Builder**: copy/paste, multi-select and auto-layout. Undo/redo, autosave, shortcuts, the
  node library, minimap and zoom/pan are done.
- **Mobile read-only canvas gate** described in `design-decision.md` §8. The canvas is usable
  but not gated below `1024`.
- **E2E tests.** None. Playwright was used for verification from a scratchpad directory and
  deliberately **not** added as a project dependency, since it was outside approved scope.

### Out of scope by design

- **New workflow node types** (Branch, Merge, Loop, Wait-for-Event, Error Handler, Human
  Approval, App Action). The executor implements seven step types; rendering nodes that cannot
  run is exactly the mock behaviour the spec forbids. This is an engine change.
- **Figma-derived visuals.** See `design-decision.md` §1.

---

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
