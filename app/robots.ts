import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://busigo.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/about", "/help", "/terms", "/privacy", "/login", "/signup"],
        // Dashboard, API routes, and public-but-private-content pages (a user's own form
        // trigger URLs) should never be crawled or indexed.
        disallow: ["/dashboard", "/workflows", "/runs", "/connections", "/forms", "/settings", "/profile", "/billing", "/admin", "/api", "/form"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
