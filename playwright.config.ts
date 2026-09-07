import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * Runs against a PRODUCTION build (`next build && next start`), not the dev server. Dev mode
 * compiles with eval-based source maps and React Refresh, which behave differently under a
 * strict CSP and produce different hydration timing — testing there would verify something
 * users never run. It also means a bad production build fails the suite rather than passing
 * quietly.
 *
 * PLAYWRIGHT_BASE_URL lets CI point at an already-running deployment instead.
 */
const PORT = Number(process.env.PORT || 3300);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    // The sandboxed image ships Chromium at a fixed path; PLAYWRIGHT_BROWSERS_PATH points
    // there, so no download is needed or wanted.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium" },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
