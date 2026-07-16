import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

// Load test environment variables
dotenv.config({
  path: path.resolve(process.cwd(), ".env.test"),
  override: true,
});

const e2ePort = process.env.E2E_TEST_PORT ?? "3100";
const e2eBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${e2ePort}`;
const e2eDistDir = process.env.NEXT_DIST_DIR ?? ".next-e2e";
const e2eServerCommand = `NEXT_DIST_DIR=${e2eDistDir} PORT=${e2ePort} ${
  process.env.CI ? "npm start" : "npm run dev"
}`;

export default defineConfig({
  globalSetup: "./tests/e2e/global-setup.ts",
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html"], ["github"], ["list"]] : "html",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: e2eServerCommand,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
