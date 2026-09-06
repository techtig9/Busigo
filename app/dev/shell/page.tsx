import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ShellPreview } from "./ShellPreview";

export const metadata = { title: "Shell preview", robots: { index: false, follow: false } };

/**
 * Application-shell preview harness.
 *
 * The real shell only renders behind Supabase auth, which makes it impossible to review
 * visually — sidebar grouping, collapse behaviour, the command palette, breadcrumbs and the
 * mobile bottom bar — without a live project and a signed-in session. This renders the same
 * AppShell with representative props so the layout can be checked in a browser.
 *
 * The sidebar cookie is read here exactly as app/(dashboard)/layout.tsx reads it, so the
 * preview exercises the real server-rendered collapse path rather than a simplified one.
 *
 * Development-only, exactly like /dev/design-system: this page 404s in production and the
 * middleware allowance for /dev/* is itself gated on NODE_ENV.
 */
export default function ShellPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const sidebarCollapsed = cookies().get("busigo-sidebar")?.value === "1";
  return <ShellPreview initialSidebarCollapsed={sidebarCollapsed} />;
}
