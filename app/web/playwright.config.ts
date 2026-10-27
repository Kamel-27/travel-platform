import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Smoke run against a production build. Every /api/v1 call is intercepted in
 * the specs (see e2e/api-mock.ts), so no backend, Postgres or Redis is needed
 * — but the pages, routing and client bundles are the real ones.
 *
 * NEXT_PUBLIC_API_URL is pointed back at the front-end's own origin so the
 * intercepted calls are same-origin and need no CORS dance.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    env: { NEXT_PUBLIC_API_URL: baseURL },
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
