# Visual reference

**Updated for the Aurora theme** — these reflect the drifting gradient background, floating
white cards, and bolder headings described in the main README's "Theme: Aurora" section, not
the earlier flat/bordered look.

These are **static HTML/CSS mockups rendered with a real Chromium browser**, built from the
exact same design tokens (`app/globals.css`'s `:root`/`.dark` CSS variables, the same colors,
the same step-connector visual) as the real components — not live screen captures of the
running Next.js app. That distinction matters: this sandbox has no network access, so `next`,
`react-dom`'s server renderer, and the Supabase client aren't installed here, which means the
actual app genuinely cannot run in this environment to be captured directly. The source HTML
for each is alongside the PNGs if you want to see exactly what was rendered.

One visual difference from the real app: these use a system font stack, since fetching IBM
Plex Sans/Mono from Google Fonts needs network access this sandbox doesn't have. The real app
self-hosts those fonts at build time via `next/font` (see `app/layout.tsx`) — no CDN dependency
in production, and you'll see the actual typeface once you run it yourself.

1. `1-landing.png` — public landing page
2. `2-dashboard-light.png` — dashboard home, light mode, with the onboarding checklist
3. `3-dashboard-dark.png` — the same page in dark mode
4. `4-workflow-builder.png` — the step-list editor with the signature connector-line visual
5. `5-pricing.png` — the public pricing page with plan comparison
6. `6-chatbot.png` — the AI Assistant widget open
7. `7-login.png` — the login page
8. `8-runs-analytics.png` — per-workflow run history with stats and CSV/JSON export
9. `9-admin.png` — the admin panel's user/subscription management table
10. `10-dashboard-mobile.png` — dashboard at a 390px mobile viewport
11. `11-search.png` — the top-nav search box mid-query, showing the grouped Workflows/Runs results dropdown
