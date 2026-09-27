import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

const script = path.resolve("scripts/check-no-db-artifacts.sh");

it.each([
  ["src/app/data/page.tsx", true],
  ["docs/data/example.json", true],
  ["src/data/example.ts", true],
  ["data/trades.csv", false],
  [".data/journal.sqlite", false],
  ["nested/.data/backup.json", false],
  ["backups/journal.sqlite", false],
  ["backups/journal.sqlite-wal", false],
  ["backups/journal.sqlite-shm", false],
])("checks tracked path %s (allowed: %s)", (trackedPath, allowed) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-hygiene-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: directory });
    const file = path.join(directory, trackedPath);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "fixture");
    execFileSync("git", ["add", "--", trackedPath], { cwd: directory });
    const result = spawnSync("bash", [script], {
      cwd: directory,
      encoding: "utf8",
    });
    expect(result.status).toBe(allowed ? 0 : 1);
    if (allowed) expect(result.stdout).toContain("check:repo-hygiene OK");
    else expect(result.stdout).toContain(trackedPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
