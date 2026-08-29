export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate">Last updated: placeholder — replace with your actual effective date before launch.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink">
        <section>
          <h2 className="font-bold">What we collect</h2>
          <p className="mt-1 text-slate">
            Account details you provide (name, email), the workflows and step configurations you
            create, and the trigger payloads and step outputs generated when your workflows run —
            stored so you can see a full trace of every run under Runs.
          </p>
        </section>
        <section>
          <h2 className="font-bold">How we use it</h2>
          <p className="mt-1 text-slate">
            To run the platform: executing your workflows, metering credit usage against your
            plan, sending failure-alert emails, and powering the in-app Assistant's answers about
            your own account. We don't sell your data.
          </p>
        </section>
        <section>
          <h2 className="font-bold">Third parties involved in running busigo</h2>
          <ul className="mt-1 list-disc pl-5 text-slate">
            <li>Supabase — database, authentication, and file storage</li>
            <li>Anthropic (Claude) — powers AI Action steps and the in-app Assistant</li>
            <li>Resend — transactional and failure-alert email delivery</li>
            <li>Paddle — subscription billing and payment processing</li>
          </ul>
        </section>
        <section>
          <h2 className="font-bold">Your AI Action data</h2>
          <p className="mt-1 text-slate">
            Content you configure into an AI Action step is sent to Anthropic's API to generate
            that step's output. It's treated as untrusted input on our side (see our engineering
            notes on prompt-injection defense) and is not used by us to train any model.
          </p>
        </section>
        <section>
          <h2 className="font-bold">Your choices</h2>
          <p className="mt-1 text-slate">
            You can export or delete your workflows and run history at any time from the
            dashboard, and request full account deletion by contacting us.
          </p>
        </section>
        <section>
          <h2 className="font-bold">Contact</h2>
          <p className="mt-1 text-slate">
            Privacy questions — <a href="mailto:techtig9@gmail.com" className="text-signal hover:underline">techtig9@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
