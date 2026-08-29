export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate">Last updated: placeholder — replace with your actual effective date before launch.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink">
        <section>
          <h2 className="font-bold">1. Using busigo</h2>
          <p className="mt-1 text-slate">
            busigo is a workflow automation platform provided by Techtig. By creating an account
            you agree to use it only for lawful purposes and in line with the plan limits and
            credit system described on the Pricing page.
          </p>
        </section>
        <section>
          <h2 className="font-bold">2. Your workflows and data</h2>
          <p className="mt-1 text-slate">
            You retain ownership of the workflows you create and the data that flows through
            them. You're responsible for the destinations you send data to (via HTTP Request or
            Send Email steps) and for having the right to send data you configure into a workflow.
          </p>
        </section>
        <section>
          <h2 className="font-bold">3. Acceptable use</h2>
          <p className="mt-1 text-slate">
            Don't use busigo to send unsolicited bulk email, attempt to bypass the platform's
            rate limits or SSRF protections, or build workflows intended to abuse a third-party
            service's terms of use.
          </p>
        </section>
        <section>
          <h2 className="font-bold">4. Billing</h2>
          <p className="mt-1 text-slate">
            Paid plans are billed in advance on a monthly or annual cycle via Paddle. Credit
            top-ups are one-time purchases and are non-refundable once the credits have been
            added to your account.
          </p>
        </section>
        <section>
          <h2 className="font-bold">5. Service availability</h2>
          <p className="mt-1 text-slate">
            busigo is provided "as is." We work to keep the platform reliable but don't guarantee
            uninterrupted availability outside of any Enterprise SLA agreed separately in writing.
          </p>
        </section>
        <section>
          <h2 className="font-bold">6. Contact</h2>
          <p className="mt-1 text-slate">
            Questions about these terms — <a href="mailto:techtig9@gmail.com" className="text-signal hover:underline">techtig9@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
