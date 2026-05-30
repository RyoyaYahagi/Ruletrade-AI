import { rmSync } from "node:fs";
import path from "node:path";

/**
 * Global setup for Playwright E2E tests.
 * Removes the SQLite test database so each test run starts fresh.
 */
export default async function globalSetup() {
  const dbPath = path.resolve(process.cwd(), "./data/e2e-test.sqlite");
  try {
    rmSync(dbPath, { force: true });
    console.log("[global-setup] Removed E2E SQLite database:", dbPath);
  } catch {
    // Ignore if file doesn't exist
  }
}
