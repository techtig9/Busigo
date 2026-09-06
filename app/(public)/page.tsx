import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Brain,
  Bot,
  Workflow,
  BarChart3,
  ShieldCheck,
  Lock,
  Plug,
  CheckCircle2,
  GitBranch,
  Sparkles,
  Clock,
} from "lucide-react";
import { APP_NAME } from "@/lib/utils";
import { PLAN_PRICE_USD, PLAN_CREDITS } from "@/lib/plans";
import { FAQS } from "@/lib/help-content";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://busigo.app";
const DESCRIPTION =
  "BusiGo is an AI business operating system: it learns how your business works, finds the highest-value automation opportunities, builds workflows, coordinates AI agents, and keeps humans in control of important decisions.";

export const metadata: Metadata = {
  title: `${APP_NAME} — Your AI Business Operating System`,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} — Your AI Business Operating System`,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: `${APP_NAME}`, description: DESCRIPTION },
};

/**
 * Structured data.
 *
 * The FAQ entries are generated from the SAME source the visible FAQ section renders
 * (lib/help-content.ts). Search engines require FAQ markup to match on-page content, and
 * hand-maintaining a second copy is how that requirement quietly gets violated.
 *
 * Deliberately absent: aggregateRating, review, and any award or certification claim. There
 * is no real ratings data behind this product yet, and inventing it is both a policy
 * violation and a manual-action risk.
 */
function StructuredData() {
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}#organization`,
        name: APP_NAME,
        url: SITE_URL,
        description: DESCRIPTION,
      },
      {
        "@type": "SoftwareApplication",
        name: APP_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Free plan with a monthly credit allowance; paid plans add credits and features.",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

const PILLARS = [
  {
    icon: Brain,
    eyebrow: "Understand",
    title: "Business Brain",
    body: "Tell BusiGo about your customers, team, processes, goals and rules — or point it at your website and let it read. It builds a living model of how your business actually works, and everything else reasons from it.",
    href: "/signup",
  },
  {
    icon: Bot,
    eyebrow: "Operate",
    title: "AI Workforce",
    body: "Deploy specialist agents for sales, support, marketing, operations and finance. Each one has explicit permissions and an autonomy level you set — and every action it takes is recorded.",
    href: "/signup",
  },
  {
    icon: Workflow,
    eyebrow: "Build",
    title: "Visual automation",
    body: "Webhook, schedule and form triggers feeding a graph of steps: HTTP requests, email, AI actions, filters, delays and transforms — with branching, retries and a full trace of every run.",
    href: "/signup",
  },
  {
    icon: BarChart3,
    eyebrow: "Measure",
    title: "Intelligence & growth",
    body: "Business health, anomalies, opportunity ranking and outcome tracking — so you can see what automation actually changed rather than assuming it helped.",
    href: "/signup",
  },
];

const PROBLEMS = [
  "Work that matters is spread across tools that don't talk to each other.",
  "The team knows which tasks are repetitive, but nobody has time to automate them.",
  "AI tools produce confident output with no way to check where it came from.",
  "Automation that runs unsupervised is a risk nobody wants to sign off on.",
];

const TRUST_POINTS = [
  {
    icon: CheckCircle2,
    title: "Every step is traced",
    body: "Real input, output, status and duration are recorded for each step of every run — success or failure. Nothing is a fabricated success.",
  },
  {
    icon: Lock,
    title: "Outbound requests are fenced",
    body: "HTTP steps are blocked from reaching private networks and cloud metadata endpoints, and workflows are protected against triggering themselves in a loop.",
  },
  {
    icon: Clock,
    title: "You only pay for completed work",
    body: "Credits are spent when a run actually completes. A run that fails is never charged.",
  },
];

// Providers the product genuinely has connector support for — not an aspirational logo wall.
const INTEGRATIONS = [
  "Gmail",
  "Google Calendar",
  "Google Sheets",
  "Slack",
  "HubSpot",
  "Notion",
  "Airtable",
  "Trello",
];

function Section({
  children,
  className = "",
  tinted = false,
}: {
  children: React.ReactNode;
  className?: string;
  tinted?: boolean;
}) {
  return (
    <section className={`${tinted ? "border-y border-hairline bg-surface/60" : ""} ${className}`}>
      <div className="mx-auto max-w-5xl px-6 py-16">{children}</div>
    </section>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-signal">{eyebrow}</p>}
      <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {body && <p className="mt-3 text-sm leading-relaxed text-slate sm:text-base">{body}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div>
      <StructuredData />

      {/* 1 — Hero */}
      <section className="px-6 py-20 text-center sm:py-28">
        <div className="mx-auto max-w-3xl animate-slide-up">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-panel/70 px-3 py-1 text-xs font-medium text-slate backdrop-blur">
            <Sparkles size={12} className="text-signal" aria-hidden />
            AI that shows its working
          </p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Your AI Business Operating System.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate sm:text-lg">
            {APP_NAME} learns how your business works, finds the highest-value opportunities, builds the automations,
            coordinates AI workers — and keeps a human in control of every decision that matters.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="group inline-flex h-11 items-center gap-1.5 rounded bg-signal-strong px-6 text-sm font-semibold text-white transition-all duration-hover hover:bg-signal-dark hover:shadow-md active:scale-[0.98]"
            >
              Start free — no card required
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center rounded border border-hairline bg-panel px-6 text-sm font-semibold text-ink transition-all duration-hover hover:border-hairline-strong"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">
            Sign up in under a minute. Every feature lives behind your account — your workflows and runs are private to
            your workspace.
          </p>
        </div>
      </section>

      {/* 2 — Problem */}
      <Section tinted>
        <SectionHead
          eyebrow="The problem"
          title="Most businesses know what to automate. Almost none get to it."
        />
        <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
          {PROBLEMS.map((p) => (
            <li key={p} className="flex items-start gap-2.5 rounded-lg border border-hairline bg-panel p-4">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
              <span className="text-sm text-slate">{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* 3–6 — Business Brain, AI Workforce, Automation, Intelligence */}
      <Section>
        <SectionHead
          eyebrow="How it works"
          title="Understand, build, operate, measure"
          body="Four pieces that share one model of your business, so a workflow knows what an agent knows and an insight knows why it matters."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-xl border border-hairline bg-panel p-6">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-signal-soft text-signal">
                <p.icon size={18} aria-hidden />
              </span>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{p.eyebrow}</p>
              <h3 className="mt-0.5 font-bold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 7 — Human approval */}
      <Section tinted>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-signal">Human approval</p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Nothing important happens without you.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate">
              You set the autonomy boundary. When an agent proposes something beyond it, the action waits in the
              Approval Center — showing the concrete change it would make, why it was proposed, and what evidence it
              was based on. Agents cannot silently cross that line.
            </p>
            <Link
              href="/signup"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-signal hover:underline"
            >
              See how approvals work <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="rounded-xl border border-hairline bg-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Send outreach to 42 contacts</p>
              <span className="inline-flex items-center gap-1 rounded bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn-ink">
                medium risk
              </span>
            </div>
            <p className="mt-2 text-xs text-slate">
              Proposed by the Sales agent after 14 leads went 7 days without follow-up.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Business Brain", "14 stale leads", "Autonomy policy"].map((e) => (
                <span
                  key={e}
                  className="inline-flex items-center gap-1 rounded border border-hairline bg-surface px-1.5 py-0.5 text-[11px] font-medium text-slate"
                >
                  <GitBranch size={10} aria-hidden />
                  {e}
                </span>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-hairline pt-3">
              <span className="rounded border border-hairline px-3 py-1.5 text-xs font-semibold text-slate">
                Reject
              </span>
              <span className="rounded bg-signal-strong px-3 py-1.5 text-xs font-semibold text-white">Approve &amp; run</span>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted">Illustration of the Approval Center</p>
          </div>
        </div>
      </Section>

      {/* 8 — Security / engineering trust */}
      <Section>
        <SectionHead
          eyebrow="Built to be trusted"
          title="The boring, essential engineering most automation tools skip"
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {TRUST_POINTS.map((t) => (
            <div key={t.title} className="rounded-xl border border-hairline bg-panel p-5">
              <t.icon size={18} className="text-signal" aria-hidden />
              <h3 className="mt-3 text-sm font-bold text-ink">{t.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate">{t.body}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted">
          Workspace data is isolated at the database level with row-level security, secrets are encrypted server-side,
          and multi-factor authentication is available on every account.
        </p>
      </Section>

      {/* 9 — Integrations */}
      <Section tinted>
        <SectionHead
          eyebrow="Connect"
          title="Works with the tools your business already runs on"
          body="Connect an account once and your workflows and agents can read and act through it, within the permissions you grant."
        />
        <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
          {INTEGRATIONS.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel px-3 py-2 text-sm font-medium text-ink"
            >
              <Plug size={13} className="text-slate" aria-hidden />
              {name}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-xs text-muted">
          Plus any HTTP API through the HTTP Request step, and inbound webhooks from anything that can post JSON.
        </p>
      </Section>

      {/* 10 — Pricing */}
      <Section>
        <SectionHead
          eyebrow="Pricing"
          title="Plans that scale with real usage"
          body="Start free. Upgrade when you need more credits, more steps, or more app connections."
        />
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
          {(["starter", "growth", "pro"] as const).map((plan) => (
            <div key={plan} className="rounded-xl border border-hairline bg-panel p-5 text-center">
              <p className="text-sm font-semibold capitalize text-ink">{plan}</p>
              <p className="tabular mt-1.5 text-3xl font-bold text-ink">
                ${PLAN_PRICE_USD[plan]}
                <span className="text-sm font-normal text-slate">/mo</span>
              </p>
              <p className="tabular mt-1 text-xs text-slate">{PLAN_CREDITS[plan].toLocaleString()} credits</p>
            </div>
          ))}
        </div>
        <div className="mt-7 text-center">
          <Link href="/pricing" className="text-sm font-semibold text-signal hover:underline">
            Compare all plans, including the free tier →
          </Link>
        </div>
      </Section>

      {/* 11 — FAQ (same source as the JSON-LD above) */}
      <Section tinted>
        <SectionHead eyebrow="FAQ" title="Questions people ask first" />
        <div className="mx-auto mt-8 max-w-2xl divide-y divide-hairline rounded-xl border border-hairline bg-panel">
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
        </div>
        <p className="mt-5 text-center text-sm text-slate">
          More in the{" "}
          <Link href="/help" className="text-signal hover:underline">
            help centre
          </Link>
          .
        </p>
      </Section>

      {/* 12 — Final CTA */}
      <section className="px-6 py-20 text-center">
        <div className="mx-auto max-w-xl">
          <ShieldCheck size={22} className="mx-auto text-signal" aria-hidden />
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Ready to automate something real?
          </h2>
          <p className="mt-3 text-sm text-slate">
            Create a workspace, connect one app, and publish your first workflow — most people get there in an evening.
          </p>
          <Link
            href="/signup"
            className="mt-7 inline-flex h-11 items-center gap-1.5 rounded bg-signal-strong px-6 text-sm font-semibold text-white transition-all duration-hover hover:bg-signal-dark hover:shadow-md active:scale-[0.98]"
          >
            Create your free account
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
