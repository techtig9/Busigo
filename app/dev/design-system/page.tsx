import { notFound } from "next/navigation";
import { Gallery } from "./Gallery";

export const metadata = { title: "BusiGo Design System", robots: { index: false, follow: false } };

/**
 * Design-system gallery — every primitive in every state, for visual QA and contrast
 * checking in both themes (docs/design-decision.md §7).
 *
 * Development-only. In production this 404s rather than shipping an internal surface on a
 * public URL — it is not behind auth, so gating it on NODE_ENV is the boundary.
 */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Gallery />;
}
