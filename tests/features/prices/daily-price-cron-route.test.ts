import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/errors/to-error-response", () => ({
  toErrorResponse: vi.fn(async (error: AppError) =>
    Response.json({ ok: false }, { status: error.status }),
  ),
}));

vi.mock("@/features/portfolio/services/price-daily-service", () => ({
  refreshDailyPrices: vi.fn(),
}));
vi.mock("@/features/notifications/services/price-alert-detection-service", () => ({
  detectPriceAlerts: vi.fn(),
}));
vi.mock("@/features/portfolio/services/drift-alert-detection-service", () => ({
  detectDriftForAllPortfolios: vi.fn(),
}));
vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

import { GET } from "@/app/api/cron/prices/daily/route";
import { refreshDailyPrices } from "@/features/portfolio/services/price-daily-service";
import { detectPriceAlerts } from "@/features/notifications/services/price-alert-detection-service";
import { detectDriftForAllPortfolios } from "@/features/portfolio/services/drift-alert-detection-service";
import { createDatabaseClient } from "@/lib/db/database-client";

describe("daily price cron route", () => {
  it("rejects a request without the cron secret", async () => {
    const previousSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";

    try {
      const response = await GET(
        new Request("http://localhost/api/cron/prices/daily"),
      );
      expect(response.status).toBe(401);
    } finally {
      if (previousSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previousSecret;
    }
  });

  it("価格保存、ルール判定、ドリフト判定の順に実行し集計値を返す", async () => {
    const previousSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";
    const events: string[] = [];
    const userQuery = {
      select: vi.fn(() => userQuery),
      eq: vi.fn(() => userQuery),
      limit: vi.fn(async () => ({
        data: [{ user_id: "user-a" }, { user_id: "user-b" }],
        error: null,
      })),
    };
    vi.mocked(createDatabaseClient).mockResolvedValue({
      from: vi.fn(() => userQuery),
    } as never);
    vi.mocked(refreshDailyPrices).mockImplementation(async () => {
      events.push("prices");
      return {
        requestedCount: 3,
        savedCount: 2,
        fxSavedCount: 1,
        failedSymbols: ["CCC"],
        provider: "mock",
      };
    });
    vi.mocked(detectPriceAlerts).mockImplementation(async ({ userId }) => {
      events.push(`alerts:${userId}`);
      return userId === "user-a"
        ? { createdCount: 2, skippedRuleCount: 1 }
        : { createdCount: 1, skippedRuleCount: 0 };
    });
    vi.mocked(detectDriftForAllPortfolios).mockImplementation(async () => {
      events.push("drift");
      return { portfolioCount: 4, createdCount: 3 };
    });

    try {
      const response = await GET(
        new Request("http://localhost/api/cron/prices/daily", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        ok: true,
        data: {
          requestedCount: 3,
          savedCount: 2,
          fxSavedCount: 1,
          failedSymbols: ["CCC"],
          alertCreatedCount: 3,
          skippedRuleCount: 1,
          driftPortfolioCount: 4,
          driftAlertCreatedCount: 3,
        },
      });
      expect(events).toEqual(["prices", "alerts:user-a", "alerts:user-b", "drift"]);
    } finally {
      if (previousSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previousSecret;
      vi.clearAllMocks();
    }
  });
});
