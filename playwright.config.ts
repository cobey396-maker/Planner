import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: a real browser clicks through the real app.
 *
 * First time on a new machine, download the browser once:
 *   npx playwright install chromium
 * Then:
 *   npm run test:e2e
 *
 * Playwright starts the app for you (or reuses one already running on 3002).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3002",
    ...devices["iPhone 13"],
    // The iPhone preset defaults to WebKit; we test in Chromium with a phone
    // viewport and touch, which is enough for layout and behavior.
    browserName: "chromium",
    // Some environments ship their own Chromium; point at it with this env var.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: "light", use: { colorScheme: "light" } },
    { name: "dark", use: { colorScheme: "dark" } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3002",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
