import Link from "next/link";
import { Mail, Phone, BookOpen, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FAQS, SUPPORT_CONTACT } from "@/lib/help-content";

export const metadata = { title: "Help & Support" };

/**
 * In-app Help Center.
 *
 * This exists because the dashboard sidebar previously linked to /help, which lives in the
 * (public) route group — clicking Help from inside the app dropped the person out of the
 * application shell entirely, losing their workspace context and navigation. The public page
 * remains as the marketing/SEO FAQ; this is the signed-in equivalent, rendered inside the
 * shell, and it shares its answers with that page via lib/help-content.ts.
 */
export default function SupportPage() {
  return (
    <>
      <PageHeader
        title="Help & Support"
        description="Answers to the questions people ask most, and a direct line to us when they don't cover it."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card interactive className="flex flex-col">
          <BookOpen size={18} className="mb-2 text-signal" aria-hidden />
          <CardTitle>Pricing &amp; plans</CardTitle>
          <CardDescription>Compare allowances and feature limits.</CardDescription>
          <div className="mt-3">
            <Button size="sm" variant="secondary" href="/pricing">
              View pricing
            </Button>
          </div>
        </Card>
        <Card interactive className="flex flex-col">
          <MessageSquare size={18} className="mb-2 text-signal" aria-hidden />
          <CardTitle>Ask the Copilot</CardTitle>
          <CardDescription>It can see your workflows, runs and usage.</CardDescription>
          <p className="mt-3 text-xs text-muted">Open it from the button in the bottom-right corner.</p>
        </Card>
        <Card interactive className="flex flex-col">
          <Mail size={18} className="mb-2 text-signal" aria-hidden />
          <CardTitle>Contact us</CardTitle>
          <CardDescription>A real person reads every message.</CardDescription>
          <div className="mt-3">
            <Button size="sm" variant="secondary" href={`mailto:${SUPPORT_CONTACT.email}`}>
              Email support
            </Button>
          </div>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink">Frequently asked</h2>
      <Card className="divide-y divide-hairline p-0">
        {FAQS.map((f) => (
          <details key={f.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal">
              {f.q}
              <span
                aria-hidden
                className="shrink-0 text-muted transition-transform duration-hover group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-slate">{f.a}</p>
          </details>
        ))}
      </Card>

      <Card className="mt-4">
        <CardTitle>Still need help?</CardTitle>
        <CardDescription>Reach us directly and we&apos;ll get back to you.</CardDescription>
        <div className="mt-3 flex flex-col gap-1.5 text-sm">
          <a
            href={`mailto:${SUPPORT_CONTACT.email}`}
            className="flex items-center gap-2 text-signal hover:underline"
          >
            <Mail size={14} aria-hidden /> {SUPPORT_CONTACT.email}
          </a>
          <a href={SUPPORT_CONTACT.phoneHref} className="flex items-center gap-2 text-signal hover:underline">
            <Phone size={14} aria-hidden /> {SUPPORT_CONTACT.phone}
          </a>
        </div>
        <p className="mt-4 text-xs text-muted">
          Looking for the public FAQ?{" "}
          <Link href="/help" className="text-signal hover:underline">
            It&apos;s here
          </Link>
          .
        </p>
      </Card>
    </>
  );
}
