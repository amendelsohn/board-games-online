import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");

/**
 * Playwright config for @bgo/web E2E tests.
 *
 * Assumes the dev servers are either already running locally (reuseExistingServer)
 * or will be spun up by Playwright in CI. Tests are single-project (Chromium)
 * and serial — match state is shared across the monorepo's in-memory store, so
 * parallelism would cause spurious interference.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @bgo/server start:dev",
      url: "http://localhost:8080/games",
      reuseExistingServer: true,
      cwd: REPO_ROOT,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm --filter @bgo/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      cwd: REPO_ROOT,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
