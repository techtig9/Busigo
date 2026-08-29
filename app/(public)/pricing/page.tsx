import { PricingClient } from "./PricingClient";

export const metadata = { title: "Pricing" };

const FAQS = [
  {
    q: "What happens if I run out of credits?",
    a: "You can buy a top-up pack any time from Billing, or wait for your monthly renewal. Runs that fail are never charged, so a broken workflow won't burn through your balance.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes — upgrade or downgrade any time from Billing. Changes take effect immediately and your credit allowance updates on your next renewal.",
  },
  {
    q: "Do unused credits roll over?",
    a: "No — credits renew each billing cycle and don't carry over, which is why every plan includes a generous monthly allowance rather than a small one you're expected to stockpile.",
  },
  {
    q: "Is there a free trial on paid plans?",
    a: "Every plan starts on Free with no credit card required, so you can build and test real workflows before paying anything. Paid plans also include a first-month discount.",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center animate-slide-up">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">Simple, credit-based pricing</h1>
        <p className="mt-3 text-slate">
          Every plan includes a generous monthly credit allowance. You're only charged when a
          workflow run actually completes — never for a run that fails.
        </p>
      </div>

      <div className="mt-10">
        <PricingClient />
      </div>

      <div className="mx-auto mt-20 max-w-2xl">
        <h2 className="text-xl font-bold text-ink">Frequently asked questions</h2>
        <div className="mt-4 space-y-4">
          {FAQS.map((f) => (
            <div key={f.q} className="border-b border-hairline pb-4">
              <h3 className="font-semibold text-ink">{f.q}</h3>
              <p className="mt-1 text-sm text-slate">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
