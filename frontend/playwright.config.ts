import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against the production build (`npm run build` → `npm run start`) wired to a
 * REAL backend with the deterministic seed loaded. Nothing in the browser is mocked.
 *
 *   backend:  alembic upgrade head && python -m app.scripts.seed --reset && uvicorn …
 *   frontend: BACKEND_INTERNAL_URL=http://127.0.0.1:8000 npm run build   (rewrites are
 *             resolved at build time) — then `npx playwright test`.
 *
 * `PORT` moves both the web server and `baseURL` (`next start` reads $PORT).
 */
const PORT = process.env.PORT || "3000";
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Journeys share one seeded database; run them serially so one never observes another's
  // half-finished state.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["junit", { outputFile: "test-results/playwright.xml" }]]
    : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        env: { PORT },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
