import Link from "next/link";

export const metadata = { title: "Help" };

const FAQS = [
  {
    q: "What's a credit?",
    a: "Credits are what busigo uses to meter usage. Publishing, editing, and testing workflows are always free — a credit is spent only when a real workflow run completes (5 credits), plus 10 more for each AI Action step that run used. A run that fails is never charged.",
  },
  {
    q: "What's a workflow run?",
    a: "A workflow run is one execution of your published workflow's step list, from trigger to finish — for example, one inbound webhook call, one scheduled tick, or one form submission. Every run gets its own full trace under Runs.",
  },
  {
    q: "What's a step?",
    a: "A step is a single action in your workflow — an HTTP Request, Send Email, Delay, Filter, Transform Data, AI Action, or Webhook Response. Steps execute in order, and each one's real input, output, status, and duration is recorded, whether it succeeds, fails, or is skipped.",
  },
  {
    q: "How do plans work?",
    a: "Free, Starter, Growth, and Pro each include a monthly credit allowance plus limits on workflow count, steps per workflow, and features like AI Actions, version history, and app connections. See Billing in your dashboard for the exact numbers on your plan, or the pricing page for a full comparison.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">Help</h1>
      <div className="mt-8 space-y-6">
        {FAQS.map((f) => (
          <div key={f.q} className="border-b border-hairline pb-6">
            <h2 className="font-bold text-ink">{f.q}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate">{f.a}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 rounded border border-hairline bg-surface p-5">
        <h2 className="font-bold text-ink">Still need help?</h2>
        <p className="mt-2 text-sm text-slate">
          Reach us directly — a real person reads every message.
        </p>
        <div className="mt-3 flex flex-col gap-1 text-sm">
          <a href="mailto:techtig9@gmail.com" className="text-signal hover:underline">
            techtig9@gmail.com
          </a>
          <a href="tel:+92 3488597892" className="text-signal hover:underline">
            +92 348 8597892
          </a>
        </div>
      </div>
      <p className="mt-6 text-sm text-slate">
        Curious who's behind busigo?{" "}
        <Link href="/about" className="text-signal hover:underline">
          Read About Us
        </Link>
        .
      </p>
    </div>
  );
}
