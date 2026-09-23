import { headers } from "next/headers";

/**
 * The origin this deployment is actually being served from.
 *
 * Every absolute URL the server builds — OAuth redirect URIs, Supabase email confirmation
 * and password-reset links, workspace invite links — used to be assembled from
 * `process.env.NEXT_PUBLIC_SITE_URL` with a literal fallback. Two different fallbacks, both
 * wrong:
 *
 *   `|| "http://localhost:3000"` (OAuth) sent a production user to a dead address on their
 *   own machine, so connecting Google, Slack, HubSpot, Notion or Airtable could not complete.
 *
 *   `|| ""` (auth and invites) produced a RELATIVE url — "/auth/callback", "/reset-password",
 *   "/invite/<token>". Supabase requires an absolute redirect, and a relative href in an
 *   email is not a link at all, so signup confirmation, password reset and workspace invites
 *   all silently failed.
 *
 * Both are replaced by deriving the origin from the request the server is currently handling,
 * with NEXT_PUBLIC_SITE_URL taking precedence when set.
 *
 * NEXT_PUBLIC_SITE_URL is checked first on purpose. An OAuth `redirect_uri` has to match the
 * value registered with the provider EXACTLY, and it must be identical at authorize time and
 * at token-exchange time. Pinning it to one configured value is the only way to guarantee
 * that when a deployment is reachable on several hostnames — which on Vercel it always is
 * (the production alias, the git-branch alias, and a unique per-deployment URL all serve the
 * same app).
 *
 * The forwarded headers come next because Vercel and most proxies terminate TLS upstream: the
 * request the Node process sees is plain http against an internal host, so `request.url`
 * alone would build `http://` links to the wrong name.
 */

function fromHeaderBag(get: (name: string) => string | null | undefined): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedHost = get("x-forwarded-host");
  const host = forwardedHost || get("host");
  if (!host) return null;

  // A proxy may forward a comma-separated chain; the first entry is the original client-facing
  // value and the rest are intermediate hops.
  const firstHost = host.split(",")[0].trim();
  const proto = (get("x-forwarded-proto") || "").split(",")[0].trim();

  // Default to https rather than http. Every real deployment is served over TLS, and the one
  // case that is not — a local dev server — sets neither forwarded header and is reached by
  // an explicit localhost host, which is handled below.
  const scheme = proto || (firstHost.startsWith("localhost") || firstHost.startsWith("127.0.0.1") ? "http" : "https");
  return `${scheme}://${firstHost}`;
}

/** Origin for a route handler, derived from the Request it was called with. */
export function originFromRequest(request: Request): string {
  const fromHeaders = fromHeaderBag((name) => request.headers.get(name));
  if (fromHeaders) return fromHeaders;
  return new URL(request.url).origin;
}

/** Origin for a Server Component or Server Action, derived from the ambient request. */
export function siteOrigin(): string {
  const h = headers();
  const derived = fromHeaderBag((name) => h.get(name));
  // Only reachable if the request carried no Host header at all, which no real HTTP/1.1 or
  // HTTP/2 client does. Falling back to the public site keeps link-building total rather than
  // throwing inside an email send.
  return derived || "https://busigo.app";
}

/** Absolute URL for a path on this deployment, for a Server Component or Server Action. */
export function absoluteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
