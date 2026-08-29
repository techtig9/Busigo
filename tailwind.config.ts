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
        canvas: cssVar("--color-canvas"), // page background
        surface: cssVar("--color-surface"), // subtle recessed areas (hover states, sidebars)
        panel: cssVar("--color-panel"), // card/dropdown/modal background — was literal white
        ink: cssVar("--color-ink"), // primary text
        slate: cssVar("--color-slate"), // muted/secondary text
        hairline: cssVar("--color-hairline"), // borders/dividers
        signal: cssVar("--color-signal"),
        "signal-dark": cssVar("--color-signal-dark"),
        pulse: cssVar("--color-pulse"),
        danger: cssVar("--color-danger"),
        warn: cssVar("--color-warn"),
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      spacing: {
        base: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
