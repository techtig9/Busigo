// Fixed, decorative, non-interactive — a plain Server Component (no "use client" needed,
// it's pure markup + CSS animation, no state or handlers). Mounted once in app/layout.tsx so
// every page, public and dashboard alike, sits above the same ambient aurora backdrop.
// See .aurora-bg / .aurora-blob in app/globals.css for the actual animation.
export function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="aurora-blob aurora-blob--1" />
      <div className="aurora-blob aurora-blob--2" />
      <div className="aurora-blob aurora-blob--3" />
    </div>
  );
}
