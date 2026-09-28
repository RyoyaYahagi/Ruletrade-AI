import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.E2E_TEST_PORT ?? "3100";
const e2eBaseUrl = `http://localhost:${e2ePort}`;
const e2eDistDir = process.env.NEXT_DIST_DIR ?? ".next-e2e";
const e2eDatabasePath = "./.data/e2e-test.sqlite";
const e2eServerCommand = `rm -f ${e2eDatabasePath} ${e2eDatabasePath}-wal ${e2eDatabasePath}-shm && NEXT_DIST_DIR=${e2eDistDir} PORT=${e2ePort} RULETRADE_DATABASE_PATH=${e2eDatabasePath} RULETRADE_E2E_DISABLE_MARKET_QUOTES=1 ${
  process.env.CI ? "npm start" : "npm run dev"
}`;

export default defineConfig({
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: e2eServerCommand,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
