export const metadata = { title: "About Us" };

const LINKS = [
  { label: "Fiverr", href: "https://www.fiverr.com/techtig" },
  { label: "Upwork", href: "https://www.upwork.com/agencies/techtig" },
  { label: "Freelancer", href: "https://www.freelancer.com/u/techtig" },
  { label: "Facebook", href: "https://www.facebook.com/techtig" },
  { label: "Instagram", href: "https://www.instagram.com/techtig9" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">About Us</h1>
      <p className="mt-6 text-base leading-relaxed text-ink">
        <strong>Techtig</strong> — An AI development agency that builds intelligent, scalable,
        and modern digital solutions. We specialize in AI-powered websites, SaaS platforms, AI
        chatbots, business automation, custom web applications, eCommerce solutions, UI/UX
        design, and digital marketing — helping businesses innovate, automate, and grow.
      </p>
      <div className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate">Find us</h2>
        <ul className="mt-3 flex flex-wrap gap-4">
          {LINKS.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal hover:underline"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
