import Link from "next/link";
import { APP_NAME } from "@/lib/utils";
import { PLAN_PRICE_USD, PLAN_CREDITS } from "@/lib/plans";
import { ShieldCheck, GitBranch, Sparkles, ArrowRight, Brain, Bot, TrendingUp } from "lucide-react";

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const FEATURES = [
  {
    icon: GitBranch,
    title: "Trigger, sequence, done",
    body: "Webhook, schedule, or public form triggers feeding an ordered list of steps — HTTP requests, emails, AI actions, filters, delays, and data transforms.",
  },
  {
    icon: ShieldCheck,
    title: "Built-in guardrails",
    body: "SSRF protection, self-trigger loop guards, rate limiting, and prompt-injection-safe AI actions — the boring, essential stuff most automation tools skip.",
  },
  {
    icon: Sparkles,
    title: "An assistant that knows your account",
    body: "The built-in Assistant sees your real workflows, credit usage, and recent run failures — so it can actually help you decide what to fix or build next.",
  },
];

const TRUST_POINTS = [
  "Every step's real input, output, status, and duration is recorded — never a fabricated success.",
  "Outbound HTTP requests are blocked from reaching private networks or cloud metadata endpoints.",
  "A run that fails is never charged — you only pay for work that actually completed.",
];

export default function LandingPage() {
  return (
    <div>
      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div className="mx-auto max-w-4xl animate-slide-up">
          <p className="text-sm font-semibold text-signal">{timeGreeting()} — let&apos;s automate something.</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Your AI Business Operating System.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate">
            {APP_NAME} learns how your business works, finds the highest-value opportunities, builds automations, coordinates AI workers, and keeps humans in control of important decisions.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-1.5 rounded bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-signal-dark hover:shadow-lg active:scale-95"
            >
              Start free — no card required
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/pricing"
              className="rounded border border-hairline px-5 py-2.5 text-sm font-semibold text-ink transition-all hover:border-signal hover:shadow-sm"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate">
            Sign up in under a minute — every feature lives behind your account, so your workflows and runs are always private to you.
          </p>
        </div>
        <div className="pointer-events-none absolute left-[8%] top-16 hidden h-16 w-16 rounded-full bg-signal/10 animate-float-slow md:block" />
        <div className="pointer-events-none absolute right-[10%] top-32 hidden h-10 w-10 rounded-full bg-pulse/15 animate-float-slow md:block" style={{ animationDelay: "1.2s" }} />
      </section>

      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 py-16 sm:grid-cols-3">
          {[
            [Brain, "Business Brain", "Tell BusiGo about your customers, team, processes, goals, documents and rules. It turns that information into a living business model."],
            [Bot, "AI Workforce", "Deploy specialist agents for sales, support, marketing, operations, finance and analytics with explicit permissions."],
            [TrendingUp, "Measure & Grow", "Find bottlenecks, prioritize automation by ROI, monitor outcomes and continuously surface the next best business action."],
          ].map(([Icon, title, body], i) => (
            <div key={title as string} className="rounded border border-hairline bg-panel p-6 shadow-float">
              <Icon size={20} className="text-signal" />
              <h3 className="mt-3 font-bold text-ink">{title as string}</h3>
              <p className="mt-2 text-sm text-slate">{body as string}</p>
            </div>
          ))}
        </div>
      </section>


      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 py-16 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="animate-slide-up rounded border border-hairline bg-panel p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <f.icon size={20} className="text-signal" />
              <h3 className="mt-3 font-bold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm text-slate">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-xl font-bold text-ink">Why the engineering details matter</h2>
        <ul className="mx-auto mt-6 max-w-2xl space-y-3">
          {TRUST_POINTS.map((point, i) => (
            <li
              key={point}
              className="animate-slide-up flex items-start gap-2 text-sm text-slate"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pulse" />
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-hairline bg-surface px-6 py-16 text-center">
        <h2 className="text-xl font-bold text-ink">Plans that scale with real usage</h2>
        <p className="mt-2 text-sm text-slate">Start free. Upgrade only when you need more credits, steps, or app connections.</p>
        <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
          {(["starter", "growth", "pro"] as const).map((plan) => (
            <div key={plan} className="rounded border border-hairline bg-panel p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
              <p className="text-sm font-semibold capitalize text-ink">{plan}</p>
              <p className="mt-1 text-2xl font-bold text-ink">
                ${PLAN_PRICE_USD[plan]}<span className="text-sm font-normal text-slate">/mo</span>
              </p>
              <p className="mt-1 text-xs text-slate">{PLAN_CREDITS[plan].toLocaleString()} credits</p>
            </div>
          ))}
        </div>
        <Link href="/pricing" className="mt-6 inline-block text-sm font-semibold text-signal hover:underline">
          Compare all plans →
        </Link>
      </section>

      <section className="px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-ink">Ready to automate something real?</h2>
        <div className="mt-6">
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded bg-signal px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-signal-dark hover:shadow-lg active:scale-95"
          >
            Create your free account
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
