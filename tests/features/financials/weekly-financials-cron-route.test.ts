import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDatabaseClient: vi.fn(),
  createFinancialsProvider: vi.fn(),
  upsertFinancialStatement: vi.fn(),
}));

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: mocks.createDatabaseClient,
}));
vi.mock("@/lib/financials/financials-provider-factory", () => ({
  createFinancialsProvider: mocks.createFinancialsProvider,
}));
vi.mock("@/features/financials/services/financial-statement-service", () => ({
  upsertFinancialStatement: mocks.upsertFinancialStatement,
}));

import { GET } from "@/app/api/cron/financials/weekly/route";

describe("weekly financials cron route", () => {
  it("保有銘柄とウォッチ銘柄を重複排除して保存する", async () => {
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";
    const positionQuery = {
      select: vi.fn(() => positionQuery),
      neq: vi.fn(() => positionQuery),
      limit: vi.fn(async () => ({ data: [{ ticker: "7203" }], error: null })),
    };
    const watchlistQuery = {
      select: vi.fn(() => watchlistQuery),
      neq: vi.fn(() => watchlistQuery),
      limit: vi.fn(async () => ({ data: [{ ticker: "7203" }, { ticker: "6758" }], error: null })),
    };
    mocks.createDatabaseClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "portfolio_positions" ? positionQuery : watchlistQuery),
    });
    const provider = {
      name: "mock",
      fetchNewStatements: vi.fn(async () => []),
    };
    mocks.createFinancialsProvider.mockReturnValue(provider);
    mocks.upsertFinancialStatement.mockResolvedValue({ statement: {} });

    try {
      const response = await GET(
        new Request("http://localhost/api/cron/financials/weekly", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );
      expect(response.status).toBe(200);
      expect(provider.fetchNewStatements).toHaveBeenCalledWith(
        expect.objectContaining({ tickers: ["7203", "6758"] }),
      );
    } finally {
      if (originalSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = originalSecret;
      vi.clearAllMocks();
    }
  });
});
