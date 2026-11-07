/**
 * Playwright's configuration of the console's end-to-end tests: a real browser, against the console on Vite's dev
 * server, against a real Smarter backend. make e2e runs them. See README.md, End-to-end tests.
 *
 * - The console runs on Vite's dev server at :5173, which is started for the tests unless it is running already
 *   (make dev), and which proxies the backend's paths to the backend at :9357 (the smarter repository's make run).
 * - global-setup.ts checks that the backend is running, and creates the throwaway user that the tests sign in as;
 *   global-teardown.ts deletes it. See backend.ts.
 * - The tests run one at a time, in Chromium: they share the user, and they are a handful of smoke tests.
 */
import { defineConfig, devices } from "@playwright/test";

/** The console, on Vite's dev server. */
const CONSOLE_URL = process.env.E2E_CONSOLE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "tests",
  outputDir: "test-results",
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60 * 1000,
  expect: { timeout: 15 * 1000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: CONSOLE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -w @smarter/console",
    cwd: "..",
    url: CONSOLE_URL,
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
