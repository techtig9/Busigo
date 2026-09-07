import { test, expect } from "@playwright/test";

/**
 * Public-surface end-to-end coverage.
 *
 * These are the routes reachable without a Supabase session, so they run anywhere — including
 * a CI job with no database. The signed-in journeys the specification lists (signup →
 * workspace → workflow → publish → run → approve) need a live Supabase project and live
 * provider credentials; see e2e/README.md for what to set and which spec covers them.
 */

const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/about",
  "/help",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
];

test.describe("public routes", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} renders without console errors or horizontal overflow`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });

      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status(), `${route} should return 200`).toBe(200);

      // Exactly one h1 per page — the heading hierarchy the design system enforces.
      await expect(page.locator("h1")).toHaveCount(1);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${route} must not scroll horizontally`).toBe(0);

      expect(errors, `${route} console`).toEqual([]);
    });
  }
});

test("landing page exposes the sections and structured data the spec requires", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Business Operating System/i);

  // JSON-LD must parse and carry the three types; malformed markup is worse than none.
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(ld).toBeTruthy();
  const parsed = JSON.parse(ld!);
  const types = parsed["@graph"].map((n: any) => n["@type"]);
  expect(types).toContain("Organization");
  expect(types).toContain("SoftwareApplication");
  expect(types).toContain("FAQPage");

  // No fabricated social proof — the spec forbids inventing ratings or reviews.
  expect(JSON.stringify(parsed)).not.toContain("aggregateRating");
  expect(JSON.stringify(parsed)).not.toContain('"@type":"Review"');
});

test("theme preference persists and applies before paint", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("busigo-theme", "dark"));
  await page.reload({ waitUntil: "domcontentloaded" });
  // The blocking script in app/layout.tsx sets this before first paint, so it is already
  // present at DOMContentLoaded rather than appearing after hydration.
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("auth pages label every field", async ({ page }) => {
  for (const route of ["/login", "/signup", "/forgot-password"]) {
    await page.goto(route);
    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();
    expect(count, `${route} should have fields`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      // A field with no accessible name is announced as unnamed by a screen reader.
      const name = await inputs.nth(i).evaluate((el) => {
        const id = el.getAttribute("id");
        const labelled = id ? document.querySelector(`label[for="${id}"]`) : null;
        return labelled?.textContent?.trim() || el.getAttribute("aria-label") || "";
      });
      expect(name, `${route} field ${i} must have a label`).not.toBe("");
    }
  }
});

test("login submits credentials without a nested form breaking hydration", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login", { waitUntil: "networkidle" });

  // Nested <form> elements are dropped by the HTML parser and previously broke hydration
  // here (React #418/#423). Both forms must survive into the DOM as siblings.
  const forms = await page.locator("form").count();
  expect(forms).toBeGreaterThanOrEqual(2);
  const nested = await page.locator("form form").count();
  expect(nested, "forms must not be nested").toBe(0);
  expect(errors).toEqual([]);
});
