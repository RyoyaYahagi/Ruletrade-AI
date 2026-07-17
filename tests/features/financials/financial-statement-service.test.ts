import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("financial statement service", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("同じ銘柄・市場・期・出典をupsertし、未取得値をnullで保持する", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-financials-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");

    const service = await import("@/features/financials/services/financial-statement-service");
    const { createSqliteClient } = await import("@/lib/db/sqlite-client");
    const statement = {
      ticker: "7203",
      market: "JP",
      fiscalPeriod: "FY2026Q1",
      revenue: 1000,
      operatingIncome: null,
      netIncome: 100,
      eps: 10,
      dividendPerShare: 2,
      equityRatio: null,
      currency: "JPY",
      filedAt: "2026-07-01",
    };

    await service.upsertFinancialStatement({ statement, source: "mock" });
    await service.upsertFinancialStatement({ statement, source: "mock" });

    const rows = await createSqliteClient()
      .from("financial_statements")
      .select("*")
      .eq("ticker", "7203");
    expect(rows.data).toHaveLength(1);
    expect(rows.data[0]).toMatchObject({
      operating_income: null,
      equity_ratio: null,
      source: "mock",
    });
  });

  it("銘柄の最新期を会計期間キーで返す", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-financials-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");

    const service = await import("@/features/financials/services/financial-statement-service");
    await service.upsertFinancialStatement({
      statement: {
        ticker: "A",
        market: "JP",
        fiscalPeriod: "FY2025",
        revenue: null,
        operatingIncome: null,
        netIncome: null,
        eps: null,
        dividendPerShare: null,
        equityRatio: null,
        currency: "JPY",
        filedAt: null,
      },
      source: "manual",
    });
    await service.upsertFinancialStatement({
      statement: {
        ticker: "A",
        market: "JP",
        fiscalPeriod: "FY2026Q1",
        revenue: 1,
        operatingIncome: null,
        netIncome: null,
        eps: null,
        dividendPerShare: null,
        equityRatio: null,
        currency: "JPY",
        filedAt: null,
      },
      source: "manual",
    });

    await expect(
      service.listLatestFinancialStatement({ ticker: "A", market: "JP" }),
    ).resolves.toMatchObject({ statement: { fiscal_period: "FY2026Q1" } });
  });
});
