/**
 * Shared help content.
 *
 * Two surfaces render this: the public marketing FAQ at /help, and the in-app Help Center at
 * /support. Keeping the answers in one module means they cannot drift — a correction to how
 * credits work should never be true on one page and stale on the other.
 */

export interface Faq {
  q: string;
  a: string;
  /** Route prefixes where this entry is contextually relevant (spec §10: contextual help). */
  context?: string[];
}

export const FAQS: Faq[] = [
  {
    q: "What's a credit?",
    a: "Credits are what BusiGo uses to meter usage. Publishing, editing, and testing workflows are always free — a credit is spent only when a real workflow run completes (5 credits), plus 10 more for each AI Action step that run used. A run that fails is never charged.",
    context: ["/billing", "/ai-studio"],
  },
  {
    q: "What's a workflow run?",
    a: "A workflow run is one execution of your published workflow's step list, from trigger to finish — for example, one inbound webhook call, one scheduled tick, or one form submission. Every run gets its own full trace under Runs.",
    context: ["/runs", "/workflows"],
  },
  {
    q: "What's a step?",
    a: "A step is a single action in your workflow — an HTTP Request, Send Email, Delay, Filter, Transform Data, AI Action, or Webhook Response. Steps execute in order, and each one's real input, output, status, and duration is recorded, whether it succeeds, fails, or is skipped.",
    context: ["/workflows"],
  },
  {
    q: "How do plans work?",
    a: "Free, Starter, Growth, and Pro each include a monthly credit allowance plus limits on workflow count, steps per workflow, and features like AI Actions, version history, and app connections. See Billing in your dashboard for the exact numbers on your plan, or the pricing page for a full comparison.",
    context: ["/billing"],
  },
  {
    q: "Which AI provider does BusiGo use?",
    a: "Requests are routed Groq → Cerebras → OpenRouter → Anthropic Claude. BusiGo fails over to the next provider only on rate-limit or quota responses, never silently on a configuration error or a bad request — so a genuine failure surfaces instead of being masked. AI Studio shows which provider served your recent requests.",
    context: ["/ai-studio", "/workflows"],
  },
  {
    q: "Who can see my workspace's data?",
    a: "Only members of that workspace. Every workflow, run, agent, connection and form belongs to a workspace, and access is enforced in the database with row-level security — not just in the interface. Switching workspaces changes what you can see everywhere in the app.",
    context: ["/settings", "/security-governance"],
  },
];

export const SUPPORT_CONTACT = {
  email: "techtig9@gmail.com",
  phone: "+92 348 8597892",
  phoneHref: "tel:+923488597892",
};

/** FAQs relevant to the route the person is currently on, most specific first. */
export function contextualFaqs(pathname: string): Faq[] {
  return FAQS.filter((f) => f.context?.some((c) => pathname.startsWith(c)));
}
