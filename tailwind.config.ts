import type { Config } from "tailwindcss";

// Colors are CSS-variable-backed (see :root / .dark in globals.css) so the whole design
// system — every bg-canvas/bg-panel/text-ink/border-hairline/etc. usage across the app —
// flips for dark mode with zero changes to component code. `<alpha-value>` lets Tailwind's
// opacity modifiers (e.g. bg-signal/10) keep working through the CSS variable indirection.
function cssVar(name: string) {
  return `rgb(var(${name}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Surfaces ---
        canvas: cssVar("--color-canvas"), // page background
        panel: cssVar("--color-panel"), // cards, dropdowns, modals
        surface: cssVar("--color-surface"), // recessed areas, hover states
        "surface-3": cssVar("--color-surface-3"), // deeper recess

        // --- Text ---
        ink: cssVar("--color-ink"), // primary text
        slate: cssVar("--color-slate"), // secondary text
        muted: cssVar("--color-muted"), // tertiary/metadata text

        // --- Neutral ramp (see globals.css: for charts/illustration, not product chrome) ---
        neutral: {
          50: cssVar("--color-neutral-50"),
          100: cssVar("--color-neutral-100"),
          200: cssVar("--color-neutral-200"),
          300: cssVar("--color-neutral-300"),
          400: cssVar("--color-neutral-400"),
          500: cssVar("--color-neutral-500"),
          600: cssVar("--color-neutral-600"),
          700: cssVar("--color-neutral-700"),
          800: cssVar("--color-neutral-800"),
          900: cssVar("--color-neutral-900"),
        },

        // --- Borders ---
        hairline: cssVar("--color-hairline"),
        "hairline-strong": cssVar("--color-hairline-strong"),

        // --- Brand (navy). `primary*` are aliases so new code can use the
        // specification's vocabulary while existing `signal*` markup keeps working. ---
        signal: cssVar("--color-signal"),
        "signal-dark": cssVar("--color-signal-dark"),
        "signal-soft": cssVar("--color-signal-soft"),
        "signal-strong": cssVar("--color-signal-strong"), // fill for solid controls (see globals.css)
        "signal-ink": cssVar("--color-signal-ink"), // navy that passes as TEXT on signal-soft
        primary: cssVar("--color-signal"),
        "primary-hover": cssVar("--color-signal-dark"),
        "primary-soft": cssVar("--color-signal-soft"),

        // --- Brand accent (orange). BRAND ONLY — hero, CTA, pipeline motion, the mark.
        // Never a status: measured against the status palette it is ΔE 1.84 from warn amber
        // under protanopia and 3.68 from danger red under tritanopia, so as a state colour it
        // would make "running" and "waiting" identical for a protanope. See globals.css. ---
        accent: cssVar("--color-accent"), // FILL
        "accent-strong": cssVar("--color-accent-strong"), // FILL under white text
        "accent-ink": cssVar("--color-accent-ink"), // orange that passes as TEXT
        "accent-soft": cssVar("--color-accent-soft"),

        // --- Accents ---
        pulse: cssVar("--color-pulse"), // the "live / executing" hue — FILL
        "pulse-ink": cssVar("--color-pulse-ink"), // cyan that passes as TEXT on light surfaces
        "accent-blue": cssVar("--color-accent-blue"),
        "accent-teal": cssVar("--color-accent-teal"),

        // --- Status ---
        success: cssVar("--color-success"), // FILL
        "success-ink": cssVar("--color-success-ink"), // green that passes as TEXT on success-soft
        "success-soft": cssVar("--color-success-soft"),
        warn: cssVar("--color-warn"), // FILL
        "warn-ink": cssVar("--color-warn-ink"), // amber that passes as TEXT on light surfaces
        "warn-soft": cssVar("--color-warn-soft"),
        danger: cssVar("--color-danger"),
        "danger-strong": cssVar("--color-danger-strong"), // FILL under white text
        "danger-ink": cssVar("--color-danger-ink"), // red that passes as TEXT on danger-soft
        "danger-soft": cssVar("--color-danger-soft"),
        info: cssVar("--color-info"), // FILL
        "info-ink": cssVar("--color-info-ink"), // blue that passes as TEXT on info-soft
        "info-soft": cssVar("--color-info-soft"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      // Fluid display sizes. A fixed 48px hero heading is oversized on a 375px phone and
      // undersized on a 1920px monitor; clamp() interpolates between a floor and a ceiling
      // against the viewport, so one class covers every breakpoint without a stack of
      // sm:/md:/lg: overrides. The preferred term uses vw PLUS a rem constant so the text
      // still scales when the user zooms — a pure-vw value ignores zoom and fails WCAG 1.4.4.
      fontSize: {
        "fluid-sm": ["clamp(0.9375rem, 0.9rem + 0.2vw, 1.0625rem)", { lineHeight: "1.6" }],
        "fluid-base": ["clamp(1rem, 0.95rem + 0.25vw, 1.1875rem)", { lineHeight: "1.65" }],
        "fluid-lg": ["clamp(1.125rem, 1rem + 0.6vw, 1.5rem)", { lineHeight: "1.45" }],
        "fluid-xl": ["clamp(1.375rem, 1.15rem + 1.1vw, 2rem)", { lineHeight: "1.3" }],
        "fluid-2xl": ["clamp(1.75rem, 1.35rem + 2vw, 2.75rem)", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        "fluid-3xl": ["clamp(2.125rem, 1.5rem + 3.1vw, 3.75rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "fluid-4xl": ["clamp(2.5rem, 1.6rem + 4.5vw, 5rem)", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
      },
      // Spec §6 radius tiering: 12px dense data, 16px standard, 20px major hero surfaces.
      // Tailwind's own lg/xl/2xl are overridden so `rounded-lg` on an existing Card picks up
      // the new card radius without touching the component.
      borderRadius: {
        DEFAULT: "8px", // small controls: badges, inputs, buttons
        md: "10px",
        lg: "12px", // dense data cards
        xl: "16px", // standard cards
        "2xl": "20px", // hero / major surfaces
      },
      // Motion tokens mirrored from globals.css so `duration-hover` etc. are available as
      // utilities and a component never hard-codes a millisecond value.
      transitionDuration: {
        micro: "120ms",
        hover: "160ms",
        popover: "200ms",
        drawer: "260ms",
        modal: "280ms",
        page: "220ms",
        major: "400ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.30, 1)",
        "in-out": "cubic-bezier(0.45, 0, 0.55, 1)",
      },
      boxShadow: {
        // Restrained elevation — cards get a hairline border first, shadow second.
        xs: "0 1px 2px rgb(var(--color-ink) / 0.04)",
        sm: "0 1px 2px rgb(var(--color-ink) / 0.04), 0 2px 6px -2px rgb(var(--color-ink) / 0.08)",
        md: "0 1px 2px rgb(var(--color-ink) / 0.04), 0 6px 16px -6px rgb(var(--color-ink) / 0.10)",
        lg: "0 1px 2px rgb(var(--color-ink) / 0.04), 0 12px 32px -10px rgb(var(--color-ink) / 0.16)",
      },
      keyframes: {
        // Radix data-state driven enter/exit for popovers, menus, dialogs and drawers.
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "zoom-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        "zoom-out": { from: { opacity: "1", transform: "scale(1)" }, to: { opacity: "0", transform: "scale(0.96)" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-out-right": { from: { transform: "translateX(0)" }, to: { transform: "translateX(100%)" } },
        "slide-in-bottom": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "slide-out-bottom": { from: { transform: "translateY(0)" }, to: { transform: "translateY(100%)" } },
      },
      animation: {
        "fade-in": "fade-in var(--motion-popover) var(--ease-out)",
        "fade-out": "fade-out var(--motion-popover) var(--ease-out)",
        "zoom-in": "zoom-in var(--motion-popover) var(--ease-out)",
        "zoom-out": "zoom-out var(--motion-popover) var(--ease-out)",
        "slide-in-right": "slide-in-right var(--motion-drawer) var(--ease-out)",
        "slide-out-right": "slide-out-right var(--motion-drawer) var(--ease-out)",
        "slide-in-bottom": "slide-in-bottom var(--motion-drawer) var(--ease-out)",
        "slide-out-bottom": "slide-out-bottom var(--motion-drawer) var(--ease-out)",
      },
    },
  },
  plugins: [],
};

export default config;
