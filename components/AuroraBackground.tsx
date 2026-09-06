// Fixed, decorative, non-interactive — a plain Server Component (no "use client" needed,
// it's pure markup + CSS animation, no state or handlers).
//
// SCOPED, not global: mounted only in app/(public)/layout.tsx so it sits behind marketing
// and auth surfaces. It is deliberately absent from the dashboard — spec §1 is explicit that
// strong gradients must never sit behind dense data (tables, run traces, workflow canvas).
// See .aurora-bg / .aurora-blob in app/globals.css for the violet/blue/cyan animation.
export function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="aurora-blob aurora-blob--1" />
      <div className="aurora-blob aurora-blob--2" />
      <div className="aurora-blob aurora-blob--3" />
    </div>
  );
}
