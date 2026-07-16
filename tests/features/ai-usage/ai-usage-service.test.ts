import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("AI usage services", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("returns usage details only for the requested user", async () => {
    const { service, db, period } = await loadService();

    await db.from("cost_limit_counters").insert({
      user_id: "user-a",
      period_start: period.periodStart,
      period_end: period.periodEnd,
      used_cost_usd: 0.31,
      limit_cost_usd: 1,
    });
    await db.from("cost_limit_counters").insert({
      user_id: "user-b",
      period_start: period.periodStart,
      period_end: period.periodEnd,
      used_cost_usd: 0.91,
      limit_cost_usd: 1,
    });
    await db.from("ai_run_logs").insert([
      {
        user_id: "user-a",
        task_type: "rule_review",
        estimated_cost_usd: 0.31,
        started_at: logTime(period.periodStart, 1),
      },
      {
        user_id: "user-b",
        task_type: "holistic_review",
        estimated_cost_usd: 0.91,
        started_at: logTime(period.periodStart, 1),
      },
    ]);

    const summary = await service.getAiUsageSummary("user-a");

    expect(summary.usedCostUsd).toBe(0.31);
    expect(summary.limitCostUsd).toBe(1);
    expect(summary.byFeature).toEqual([
      { taskType: "rule_review", callCount: 1, costUsd: 0.31 },
    ]);
  });

  it("sums fallback log usage per user in the admin view", async () => {
    const { service, db, period } = await loadService();

    await db.from("ai_run_logs").insert([
      {
        user_id: "user-a",
        task_type: "rule_review",
        estimated_cost_usd: 0.2,
        started_at: logTime(period.periodStart, 1),
      },
      {
        user_id: "user-a",
        task_type: "watchlist_review",
        estimated_cost_usd: 0.3,
        started_at: logTime(period.periodStart, 2),
      },
    ]);

    const usage = await service.getAdminAiUsage();

    expect(usage.totalCostUsd).toBe(0.5);
    expect(usage.topUsers).toEqual([{ userId: "user-a", costUsd: 0.5 }]);
  });

  async function loadService() {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ruletrade-ai-usage-"),
    );
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");

    const service = await import("@/features/ai/services/ai-usage-service");
    const { createSqliteClient } = await import("@/lib/db/sqlite-client");
    const { getMonthlyCostPeriod } =
      await import("@/lib/cost-limit/cost-limit-period");
    return {
      service,
      db: createSqliteClient(),
      period: getMonthlyCostPeriod(),
    };
  }

  function logTime(periodStart: string, hours: number) {
    return new Date(
      new Date(periodStart).getTime() + hours * 60 * 60 * 1000,
    ).toISOString();
  }
});
