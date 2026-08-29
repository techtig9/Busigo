/** @type {import('next').NextConfig} */

// Real domains this app actually loads from client-side — kept to an explicit allowlist
// rather than a broad wildcard. Paddle's checkout overlay is the only third-party script/
// frame in the app (see app/(dashboard)/billing/{CheckoutButton,BuyCreditsButton}.tsx);
// everything else is same-origin or the app's own configured Supabase project.
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();

const PADDLE_SCRIPT = "https://cdn.paddle.com https://sandbox-cdn.paddle.com";
const PADDLE_FRAME = "https://buy.paddle.com https://sandbox-buy.paddle.com";

// script-src still needs 'unsafe-inline': Next.js App Router injects inline hydration/RSC
// payload scripts, and this project isn't on a nonce-based CSP (that needs a per-request
// nonce generated in middleware and threaded through every <Script> tag — a larger, riskier
// change than fits this pass). Documented here rather than silently shipped as if it were a
// strict CSP — see PRODUCTION_READINESS.md for the follow-up. style-src needs 'unsafe-inline'
// for the same reason plus this app's own inline style={{...}} usage (progress bars, etc.).
const CSP = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' ${PADDLE_SCRIPT}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  `frame-src ${PADDLE_FRAME}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
]
  .filter(Boolean)
  .join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // Belt-and-suspenders with frame-ancestors above — X-Frame-Options is still honored by a
  // couple of older browsers that don't read the CSP directive.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  // Only takes effect once actually served over HTTPS (Vercel/most hosts do this by
  // default) — harmless locally over http, where browsers ignore it.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

module.exports = nextConfig;
