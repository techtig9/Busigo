import { notFound } from "next/navigation";
import { BuilderPreview } from "./BuilderPreview";

export const metadata = { title: "Builder preview", robots: { index: false, follow: false } };

/**
 * Workflow-builder preview harness.
 *
 * The builder is the product's flagship screen and only renders behind Supabase auth with a
 * real workflow row, which makes the three-panel layout, undo/redo and autosave states
 * impossible to review otherwise. Same double gating as the other /dev pages: 404 in
 * production, and the middleware allowance for /dev/* is itself development-only.
 */
export default function BuilderPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BuilderPreview />;
}
