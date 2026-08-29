import type { MetadataRoute } from "next";

// Only public, unauthenticated pages belong here — dashboard routes are behind login and
// shouldn't be indexed or crawled at all.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://busigo.app";
  const routes = ["", "/pricing", "/about", "/help", "/terms", "/privacy", "/login", "/signup"];

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/pricing" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/pricing" ? 0.9 : 0.5,
  }));
}
