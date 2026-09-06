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

        // --- Borders ---
        hairline: cssVar("--color-hairline"),
        "hairline-strong": cssVar("--color-hairline-strong"),

        // --- Brand (violet). `primary*` are aliases so new code can use the
        // specification's vocabulary while existing `signal*` markup keeps working. ---
        signal: cssVar("--color-signal"),
        "signal-dark": cssVar("--color-signal-dark"),
        "signal-soft": cssVar("--color-signal-soft"),
        "signal-strong": cssVar("--color-signal-strong"), // fill for solid controls (see globals.css)
        "signal-ink": cssVar("--color-signal-ink"), // violet that passes as TEXT on signal-soft
        primary: cssVar("--color-signal"),
        "primary-hover": cssVar("--color-signal-dark"),
        "primary-soft": cssVar("--color-signal-soft"),

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
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
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
