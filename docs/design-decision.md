# BusiGo — Frontend Design Decision

**Status:** Decided · **Date:** 2026-09-06 · **Supersedes:** nothing (first record)

This document records the design foundation chosen for the BusiGo frontend redesign, the
evidence behind that choice, and the strategy that follows from it. It exists because the
frontend master prompt requires the foundation decision to be made explicitly and recorded
before implementation begins.

---

## 1. Figma source selected

**None. No Figma design source was selected, because none is reachable — and even if one
were supplied, the connected account's plan tier cannot sustain a design-to-code pipeline.**

BusiGo's design foundation will instead be a **code-native design system** built in this
repository, derived from the written specification's mandated palette and the existing
token architecture in `app/globals.css` + `tailwind.config.ts`.

This is not a preference or a shortcut. It follows from two independently verified facts.

### Evidence A — no design content is exposed by the connector

The Figma MCP connector is authenticated and healthy:

```
whoami → handle: Saad Saad Ali
         plan:   "Saad Saad Ali's team"
         tier:   starter
         seat:   View
```

But every design-reading tool in the Figma MCP surface (`get_design_context`,
`get_metadata`, `get_libraries`, `get_variable_defs`, `search_design_system`,
`get_screenshot`) takes a **required `fileKey` parameter**, and the server exposes
**no file-discovery tool** — there is no "list my files", "list my projects", or
"list my teams" capability anywhere in the toolset.

A full enumeration of the connector's MCP resources returned **zero design files, zero
design libraries, and zero UI kits**. The complete resource surface is:

| Resource class | Count | Design value |
|---|---|---|
| Figma skill documents (`skill://figma/*`) | 14 skills + 48 references | None — agent instructions |
| Figma MCP help docs (`file://figma/docs/*`) | 24 | None — troubleshooting |
| Shader runtime source (`file:///shader-runtime/*`) | 7 | None — WebGPU runtime |
| MCP widget templates (`ui://widget/*`) | 2 | None |
| **Design files / libraries / UI kits** | **0** | — |

Supporting probes:
- `list_generative_plugins` → `{"items": [], "nextCursor": null}` — empty.
- `list_shaders` → 35 results, **all `owner: "figma"`** — first-party stock visual effects
  (Bloom, Halftone, Mesh gradient, Nebula…). These are decorative raster effects, not a
  design system. None is usable as a SaaS UI foundation.

No Figma URL appears anywhere in this repository, in either specification document, or in
the session context.

### Evidence B — the plan tier cannot support design-to-code at this scale

From Figma's own MCP documentation (`file://figma/docs/rate-limits-access.md`), quoted
verbatim:

> | Seat | Starter |
> |---|---|
> | View, Collab | Up to 20/month |

This account is **Starter tier, View seat → a hard ceiling of ~20 MCP read calls per
month.** (`whoami` and write tools are exempt; the design-reading tools are not.)

A genuine design-to-code pass over BusiGo's **42 routes** needs, conservatively,
`get_metadata` + `get_design_context` + `get_screenshot` per screen — **126+ read calls
minimum**, before a single component variant or interaction state is inspected. The
available monthly budget is roughly **16% of what one screen-by-screen pass would cost**,
and it does not replenish until next month.

**Conclusion:** Figma cannot be the source of truth for this project at this plan tier.
Designing around a dependency that exhausts itself after ~6 screens would produce an
inconsistent frontend — the first few screens Figma-derived, the remaining ~36 improvised.
A single coherent code-native system is strictly better than a half-Figma hybrid.

### What would change this decision

Either of the following, and I will revisit before Phase 2 begins:

1. **A Figma file URL** (`https://figma.com/design/<fileKey>/…`). Even inside the ~20-call
   budget I can extract high-value, low-call-count assets — `get_variable_defs` on a
   design-system file returns the full token set in **one call**. Two or three calls spent
   on tokens and one hero screen is a good trade; 126 calls walking every screen is not.
2. **A seat/plan upgrade** to a Full or Dev seat (200 calls/day, 10/min), which makes a
   real design-to-code pipeline viable.

Until then, the code-native system below is the foundation, and it is designed so that
Figma tokens can be **merged into it later** without a rewrite (see §7).

### Not a substitute, but used as reference

`docs/screenshots/` contains 11 PNGs and 9 hand-written HTML mockups of the current Aurora
direction. These are treated as a **"before" baseline** for regression comparison — not as
a design foundation.

---

## 2. Why it was selected

Scored against the evaluation criteria the brief requires. A Figma foundation is scored on
what it could deliver *if a file existed*; the code-native foundation on what it delivers
today.

| Criterion | Figma foundation | Code-native foundation | Winner |
|---|---|---|---|
| Availability | **Unavailable** — no file reachable | Available now | Code |
| Sustainable under quota | ~20 reads/month vs 126+ needed | Unlimited | Code |
| AI-native UX fit | Unknown — no file to assess | Designed for it from the spec | Code |
| Workflow-builder suitability | No UI kit ships a DAG canvas | React Flow already integrated | Code |
| Data density / tables | Depends on unseen file | Built to spec's calm-density rule | Code |
| Design tokens | Would need extraction | **Already exists** — CSS vars + Tailwind alpha channel | Code |
| Light + dark mode | Depends on unseen file | **Already exists** — parallel navy dark palette | Code |
| Accessibility | Figma cannot encode focus order, ARIA, or live regions | Radix primitives encode them structurally | Code |
| Interaction / loading / empty / error states | Static frames at best | Real React states, testable | Code |
| Reusable components / variants | Would map to props | Maps directly to props | Tie |
| Responsive behavior | Fixed frames per breakpoint | Real fluid CSS, testable at 6 widths | Code |
| Maintainability | Two sources of truth to keep in sync | One source of truth | Code |

Three points carry the decision beyond mere availability:

1. **The token architecture already in this repo is genuinely good.** `tailwind.config.ts`
   maps every color through `rgb(var(--token) / <alpha-value>)`, so opacity modifiers
   (`bg-primary/10`) survive the CSS-variable indirection, and dark mode flips via one class
   with zero component changes. Only **2 hard-coded hex values exist across all of `app/` and
   `components/`**. That is a stronger, more disciplined foundation than most Figma UI kits
   translate into. Replacing it with a Figma-derived system would be a downgrade.

2. **Figma cannot express what BusiGo's hardest screens need.** The Workflow Builder is a
   live DAG canvas with execution state streaming over SSE; Runs is a timeline over real
   traces; the Copilot streams tokens with evidence citations. No static frame encodes any
   of that. These screens are won in code or not at all.

3. **Accessibility is structural, not visual.** The audit found **zero** occurrences of
   `role="dialog"`, `aria-modal`, or `aria-live` in the entire codebase. That gap is closed
   by Radix primitives and focus management — neither of which a Figma file can supply.

---

## 3. What will be reused

Preserved as-is, or extended in place. Nothing here gets rewritten.

**Backend and integrations — untouched by this redesign:**
- `lib/engine/*` — executor, DAG graph, retry, SSRF guard, cron, merge fields, 7 step handlers
- `lib/ai/*` — **provider order `groq → cerebras → openrouter → anthropic`
  (`lib/ai/provider.ts:31`) is frozen.** Quota-only failover (429/402/recognized quota
  messages), the separate Anthropic `/v1/messages` code path, and the cooldown/circuit-breaker
  in `lib/ai/observability.ts` all stay exactly as they are
- `lib/workspace/*`, `lib/security/*`, `lib/integrations/*`, `lib/platform/*`, all 22
  `lib/actions/*` server actions
- 19 Supabase migrations and RLS policies · `middleware.ts` MFA step-up · `next.config.js` CSP
- Paddle billing, Resend email, all 16 API route handlers
- 15 test files, 4 QA scripts

**Frontend architecture — kept:**
- Next.js 14 App Router, server-first rendering, Server Actions for every mutation.
  The redesign is a **presentation refactor**: existing controls keep their existing actions.
- The CSS-variable → Tailwind token mechanism (values change, mechanism does not)
- `prefers-reduced-motion` global block, `:focus-visible` fallback ring, the blocking
  pre-paint theme script in `app/layout.tsx` (no flash of wrong theme)
- `.skeleton` shimmer, `.stagger-*` utilities, `slideUp`'s `cubic-bezier(.16,1,.3,1)`
- **IBM Plex Mono** is retained for code, JSON payloads, logs, run IDs and webhook bodies.
  It is already installed, it reads well in dense traces, and it gives BusiGo a subtly
  operational character. Only the *sans* face changes.

**Components — extended, not replaced:**
- `WorkflowCanvas` + `StepNode` + `NodeConfigPanel` — React Flow with true/false branch
  handles, live graph validation, ancestor-aware merge-field refs. **Extend; never rewrite.**
- `ChatWidget` — already streams via a fetch reader, renders evidence chips from the
  `X-Copilot-Evidence` header, and varies suggested prompts by route. This is closer to the
  spec's Copilot than the spec assumes. Refactored into a docked panel, logic preserved.
- `TestRunPanel` (SSE), `VersionHistory`, `StepConfigForm`, `MergeFieldPicker`
- `WorkspaceSwitcher`, `SidebarLinks` (already correctly shared with the mobile drawer)
- `Button`, `Badge` + `statusTone()`, `Input` family, `Toast`, `ThemeToggle`, `AuroraBackground`

---

## 4. What will be redesigned

**Tokens.** Expand 11 → ~24 semantic tokens and adopt the specification's mandated palette.
Old Tailwind class names are **kept as aliases** so the existing ~3,850 lines of page markup
continue to compile unchanged — `bg-panel` keeps working, it simply resolves to a new value.

| Current token | New token | Light | Dark |
|---|---|---|---|
| `canvas` | `bg` | `#F7F8FC` | `#0D111B` |
| `panel` | `surface` | `#FFFFFF` | `#181E2D` |
| `surface` | `surface-2` | `#F3F5FA` | `#151A27` |
| `ink` | `text` | `#172033` | `#EDEFF3` |
| `slate` | `text-secondary` | `#657087` | `#949EB2` |
| `hairline` | `border` | `#E4E8F0` | `#2B3347` |
| `signal` (navy) | `primary` | **`#6D4AFF`** | `#8B6EFF` |
| `signal-dark` | `primary-hover` | `#5B3BEA` | `#A18BFF` |
| `pulse` (teal) | `accent-cyan` | **`#20B8D8`** | `#3DD0EE` |
| — *(new)* | `success` | `#16A36B` | `#3FBF8B` |
| `warn` | `warning` | `#E8A317` | `#D9A441` |
| `danger` | `danger` | `#E55353` | `#E06A62` |

Plus soft variants (`primary-soft`, `success-soft`, `warning-soft`, `danger-soft`,
`info-soft`), `text-muted`, `border-strong`, and tiered radius/shadow scales.

> **Semantic bug fixed in passing:** `Badge`'s `success`, `good`, and `signal` tones all
> currently resolve to the same navy — success and neutral are visually identical today.
> The new `success` green makes the distinction real.

**Screens.** Every dashboard page is currently a vertical stack of large equal-weight cards;
several (`opportunities`, `insights`, `approvals`, `workforce`, `marketplace`) are written
as single-line JSX walls. All are restructured to calm density:

- **Command Center** → compact KPI strip, health trend, opportunity radar, "what needs attention"
- **Opportunities** → priority list/board with impact · effort · confidence · evidence · owner
- **Approvals** → inbox with action preview/diff, risk, evidence, affected records
- **Workforce** → agent cards + detail tabs
- **Insights / BI / Growth** → decision-oriented charts, not chart wallpaper
- **Workflow Builder** → full-height 3-panel (library / canvas / properties + bottom console)
- **Runs** → timeline-first with detail drawer, retry-from-step, replay
- **Settings** → real tabs (currently `max-w-lg` wrapping a 325-line panel)
- **Landing** → the specification's 12 sections (currently 3 features + 3 trust points)

**Shell.** Flat 25-item sidebar → grouped nav (Command / Build / Operate / Intelligence /
Connect / System), collapsible with icon-only mode and persisted state; `PageHeader`,
breadcrumbs, ⌘K command palette, one canonical container width (currently 6 different
`max-w-*` values across 30 dashboard pages, so the layout visibly jumps on navigation).

**Route fix.** The dashboard sidebar links to `/help`, which lives in the `(public)` route
group — clicking Help from inside the app drops the user out of the application shell. A
`(dashboard)/help` Help Center is added; the public page remains for marketing.

**Theme.** Two-state toggle → **three-state** (system / light / dark), as the spec requires.

---

## 5. What will be rejected

Explicitly out of scope or actively refused, with reasons.

| Rejected | Why |
|---|---|
| **Figma as source of truth** | Unreachable, and ~20 reads/month against 126+ needed (§1) |
| **shadcn/ui via its CLI** | Copies ~50 opinionated components with their own token names, colliding with a token system that already works. Radix primitives are vendored in behind BusiGo wrappers instead |
| **Framer Motion** | The spec permits "existing motion library **or** Framer Motion". CSS keyframes already cover every required animation, already respect reduced-motion globally, and add zero bundle weight. Signal Pulse is a keyframe, not a library |
| **Global Aurora behind data** | Currently `position: fixed` behind *every* page. The spec is explicit: *"Never place strong gradients behind dense data."* Aurora is scoped to marketing, auth, onboarding and AI-generation surfaces only |
| **"Every section is a giant card"** | The current dashboard pattern; forbidden by spec §2 and §23 |
| **Dark-first design** | The spec mandates light-first showcase. Dark stays fully first-class, not primary |
| **Glassmorphism, neon/cyberpunk, rainbow accents, decorative 3D, constant animation** | Explicitly forbidden by the spec, and wrong for a product whose value proposition is trust |
| **Node types the engine cannot execute** | The spec's node library asks for Branch, Merge, Loop/ForEach, Wait-for-Event, Error Handler, Human Approval and App Action nodes. The executor implements **7 step types only** (`http_request`, `send_email`, `delay`, `filter`, `transform_data`, `ai_action`, `webhook_response`). Rendering nodes that cannot run is exactly the "mock production behavior" the spec forbids. **This pass ships the 7 real types; new node types are an engine change, tracked separately** |
| **Copying Linear / Stripe / Vercel / Attio / Supabase** | Used as quality references only. See §6 for how BusiGo differs from each |
| **Fake logos, testimonials, statistics, certifications** | Forbidden by spec §30, and corrosive to a trust-led product |

---

## 6. BusiGo-specific design decisions

### Identity: "Glass Box Automation"

Most AI products are black boxes — they assert, and you trust them. BusiGo's differentiator,
already present in its backend, is that **every claim carries its evidence and every
automated action is inspectable**: per-step execution traces, evidence citations on Copilot
replies, explicit approval boundaries, and the honest guarantee that a failed run is never
charged.

The visual language makes that legible. Where a competitor shows a confident answer, BusiGo
shows a confident answer **with its receipts attached**.

Three design consequences, applied consistently:

1. **Provenance is a first-class affordance.** Any AI-generated or AI-inferred value carries
   a source indicator, and where useful a confidence badge and a "show me why" entry point.
   Never a bare number where a sourced number is possible.
2. **Evidence chips are a shared primitive**, not a Copilot-only detail. They already exist
   in embryo in `ChatWidget`'s `X-Copilot-Evidence` handling; they are promoted to the
   design system and reused in Opportunities, Approvals, Insights and Business Brain.
3. **Approval surfaces never abstract the action.** The spec is blunt: *"Never hide the actual
   action behind vague labels."* Approvals show the concrete proposed change — a real diff
   over real records.

### Signature motion: Signal Pulse

A violet → cyan gradient travelling along a status line, used **only** while real work is
executing: workflow runs, AI generation, agent activity, live connector sync. Its meaning
comes from its scarcity — if it pulses, something is genuinely happening right now. It is
never decorative, never idle, never used on a static page.

A proto-version already exists (`.step-node--running` in `globals.css`) and is generalised.

### Palette identity

The spec mandates violet `#6D4AFF` as primary. BusiGo's own signature is the **violet →
cyan (`#20B8D8`) pairing reserved for the live-execution state**, over navy `#172033` type
on a near-white `#F7F8FC` ground. Violet is intent, cyan is motion, green is outcome.

How that reads against the reference products — none of which BusiGo imitates:

| Reference | Its signature | How BusiGo differs |
|---|---|---|
| Linear | Dark-first, keyboard-dense, purple-blue | Light-first; command palette without the dark-mode-native identity |
| Stripe | Very light, document-like, indigo | Operational density over document calm |
| Vercel | Monochrome, near-brutalist | Chromatic status language — status is never monochrome |
| Supabase | Dark developer-green | Business-operator audience, light-first, green reserved for success only |
| Attio | Neutral data-grid, restrained | Same density discipline, but with an explicit AI/provenance layer Attio has no need for |

### Typography

**Inter** for UI (replacing IBM Plex Sans), **IBM Plex Mono retained** for code, JSON, logs
and identifiers. `font-variant-numeric: tabular-nums` on all metrics, KPIs and table numerics
so digits stop jittering as values update.

### Aurora, disciplined

Retained as brand atmosphere — violet/blue/cyan, blurred, low-opacity, slow-drifting — but
**scoped**: marketing, auth, onboarding and AI-generation surfaces only. Never behind tables,
canvases, run traces or any dense data.

---

## 7. Component strategy

**Three tiers, one direction of dependency** (features → composites → primitives; never upward).

**Tier 1 — Primitives** (`components/ui/*`) — Radix behaviour + BusiGo tokens, no business logic:

> `Button` · `IconButton` · `Input`/`Textarea`/`Select`/`Label` · `Checkbox` · `Radio` ·
> `Switch` · `Card` (with header/body/footer slots) · `Badge` · `StatusBadge` · `Avatar` ·
> `AvatarGroup` · `Tooltip` · `Popover` · `Dropdown` · `Combobox` · `Tabs` · `Modal` ·
> `Drawer` · `Sheet` · `ConfirmDialog` · `Toast` · `Skeleton` · `Progress` · `Separator` ·
> `Breadcrumbs` · `JSONViewer`

**Tier 2 — Composites** (`components/patterns/*`) — assembled from Tier 1, still domain-agnostic:

> `PageHeader` · `MetricCard` · `DataTable` (sort/filter/paginate/empty/loading) · `FilterBar` ·
> `EmptyState` · `ErrorState` · `Timeline` · `ActivityFeed` · `ChartCard` · `CommandPalette` ·
> `PermissionGate` · `EvidenceChip` · `ConfidenceBadge` · `SignalPulse`

**Tier 3 — Feature components** (`components/<domain>/*`) — existing domain folders, refactored
to consume Tiers 1–2 instead of hand-rolling markup:

> `AgentCard` · `OpportunityRow` · `ApprovalCard` · `RunTimeline` · `ConnectionCard` ·
> `WorkflowCanvas`* · `WorkflowNode`* · `NodePalette` · `NodeProperties` · `CopilotPanel`* ·
> `ActionPreview` · `EvidenceDrawer`   *(\* = extended from existing code, not new)*

**Rules:**
- Every component supports **default · hover · focus-visible · active · disabled · loading ·
  error**, plus light and dark, or it is not done.
- Tokens only. No hard-coded colors — the repo is at 2 stray hex values today and that number
  does not go up.
- Loading states preserve layout dimensions (no reflow); buttons keep their width while loading.
- `cn()` is upgraded to `clsx` + `tailwind-merge` so wrapper class overrides resolve predictably.
- A `/dev/design-system` gallery page renders every component in every state for visual QA and
  contrast checking. Development-only; excluded from production routing.

**Figma re-entry path.** Because tokens live in one CSS-variable block, a future
`get_variable_defs` extraction (one MCP call) can be reconciled into that single file without
touching a component. The foundation stays Figma-compatible without being Figma-dependent.

---

## 8. Responsive strategy

Mobile-first CSS, verified at the six widths the spec names: **1440 · 1280 · 1024 · 768 ·
390 · 360**. Hard requirement: **no horizontal page overflow at any width.**

| Range | Shell | Content |
|---|---|---|
| ≥1280 | Persistent sidebar, optional icon-only collapse | Multi-column; side panels inline |
| 1024–1279 | Collapsible sidebar, icon-only default | Reduced columns; inspectors become drawers |
| 768–1023 | Sidebar → overlay drawer | Single/two column; tables scroll in their own container |
| <768 | Bottom nav (primary areas) + drawer (full nav) | Single column; detail panels become sheets |

**Specific decisions:**
- **Tables** become stacked cards below `768`, or scroll inside their own `overflow-x: auto`
  container with a sticky first column — never by letting the page scroll sideways.
- **Workflow Builder** is honest about mobile: below `1024` it presents a **read-only canvas**
  (pan/zoom, node inspection, run status) with an explicit "Edit on a larger screen" affordance.
  A cramped fake editor that silently corrupts a graph is worse than a clear boundary.
- **Modals** become bottom sheets below `768`.
- **Touch targets** ≥44×44px on all interactive elements below `1024`.
- The current global `(dashboard)/loading.tsx` serving all 30 routes is replaced by
  **layout-matching skeletons per route**, so loading never reflows into a different shape.

---

## 9. Animation strategy

**CSS-only. No animation library.** Every required animation is expressible in keyframes and
transitions; the existing global `prefers-reduced-motion` block then covers all of it in one
place, which a JS library would bypass.

**Duration tokens** (from the spec's timing scale):

```
--motion-micro:    120ms   /* checkbox, toggle, icon swap        */
--motion-hover:    160ms   /* hover, focus, button states        */
--motion-popover:  200ms   /* dropdown, tooltip, popover         */
--motion-drawer:   260ms   /* drawer, sheet                      */
--motion-modal:    280ms   /* modal, dialog                      */
--motion-page:     220ms   /* route transition                   */
--motion-major:    400ms   /* workflow/AI execution sequences    */

--ease-out:    cubic-bezier(0.16, 1, 0.30, 1);   /* already in use, retained */
--ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);
```

Ease-out and ease-in-out only. No spring or bounce — the spec calls for purposeful motion,
not playfulness, and this product's tone is operational trust.

**Shipping:** button hover/focus · sidebar active indicator · page transitions ·
drawer/modal/dropdown/toast · skeleton shimmer · first-load KPI count-up · chart reveal ·
**Signal Pulse** (workflow node execution, connector progress, agent working, AI streaming) ·
approval state change · drag/drop feedback · success checkmark.

**Not shipping:** continuous ambient animation, animated dense tables, animated large
gradients, anything that moves without communicating state.

**Reduced motion:** the existing global block clamps all animation/transition to `0.01ms`.
Every animation is verified under it — Signal Pulse in particular degrades to a **static
cyan state indicator**, so the information ("this is running") survives even when the motion
does not. Motion is never the sole carrier of meaning.

---

## 10. Accessibility strategy

**Target: WCAG 2.2 AA.** This is the largest gap between the current code and the
specification — the audit found **zero** occurrences of `role="dialog"`, `aria-modal`, or
`aria-live` anywhere in the codebase, and every dropdown (notifications, profile, workspace
switcher, search, node palette) is a plain `div` with no menu semantics, no focus trap, and
no focus restoration.

**Approach — structural first.** Radix primitives supply correct roles, focus traps, focus
restoration, typeahead, roving tabindex and dismissal semantics as a property of the
component, rather than as per-page discipline that decays. This is the single highest-leverage
accessibility decision available, and it is the main reason Radix is being added.

**Commitments:**

- **Keyboard:** every interactive element reachable and operable; logical tab order; visible
  `:focus-visible` on all of them (the existing global fallback ring is retained as a
  safety net); ⌘K palette fully keyboard-driven; Escape closes every overlay; focus returns
  to the trigger on close.
- **Screen readers:** semantic HTML first, ARIA only to fill genuine gaps; accessible names
  on every icon-only control (currently partial); `aria-live` regions for toasts, streaming
  Copilot output, run status changes and validation errors; `aria-busy` during loading.
- **Color and status:** contrast ≥4.5:1 body / ≥3:1 large text and UI boundaries, verified in
  **both** themes; status is **never** communicated by color alone — every status carries an
  icon or text label alongside its hue.
- **Charts:** each chart has a text summary and an accessible data table alternative, so
  insight is never locked inside an SVG.
- **Motion:** `prefers-reduced-motion` honoured globally; no information conveyed by motion
  alone (see §9).
- **Forms:** programmatically associated labels, inline validation tied via
  `aria-describedby`, errors announced, never color-only.
- **Targets:** ≥44×44px touch targets below `1024`.

**Verification** happens in the QA phase: keyboard-only traversal of all 42 routes, screen
reader spot-checks on the highest-traffic flows (auth, Command Center, Workflow Builder,
Approvals, Billing), automated contrast audit across both themes, and reduced-motion
verification of every animation.

---

## Open items

1. **Figma file URL** — would let me spend the remaining monthly call budget on
   high-value extraction (`get_variable_defs` returns a full token set in one call). Not a
   blocker; §7 keeps the door open.
2. **Dependency approval** — `@radix-ui/react-*` (accessibility, load-bearing for §10),
   `recharts` (charts; the repo currently has **zero** chart code and five screens need it),
   `tailwind-merge` (predictable class overrides). All three are load-bearing for spec
   compliance.
3. **Palette confirmation** — moving from navy `#2B3A67` to violet `#6D4AFF` is the most
   visible single change in the redesign and is the one decision that is expensive to reverse
   once ~40 screens are built on it.
