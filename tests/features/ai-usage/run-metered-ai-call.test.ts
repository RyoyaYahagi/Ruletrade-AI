import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAiCostLimit: vi.fn(),
  incrementAiCostUsage: vi.fn(),
  createNotification: vi.fn(),
  getUserAiBudgetSetting: vi.fn(),
  markAiBudgetWarningPeriod: vi.fn(),
}));

vi.mock("@/lib/cost-limit/check-ai-cost-limit", () => ({
  checkAiCostLimit: mocks.checkAiCostLimit,
}));
vi.mock("@/lib/cost-limit/increment-ai-cost-usage", () => ({
  incrementAiCostUsage: mocks.incrementAiCostUsage,
}));
vi.mock("@/features/notifications/services/notification-service", () => ({
  createNotification: mocks.createNotification,
}));
vi.mock("@/lib/cost-limit/budget-settings-service", () => ({
  getUserAiBudgetSetting: mocks.getUserAiBudgetSetting,
  markAiBudgetWarningPeriod: mocks.markAiBudgetWarningPeriod,
}));

import { runMeteredAiCall } from "@/lib/cost-limit/run-metered-ai-call";

describe("runMeteredAiCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAiCostLimit.mockResolvedValue({
      allowed: true,
      usedCostUsd: 0,
      limitCostUsd: 1,
      remainingCostUsd: 1,
      periodStart: "2026-07-01T00:00:00.000Z",
      periodEnd: "2026-08-01T00:00:00.000Z",
    });
    mocks.incrementAiCostUsage.mockResolvedValue(0.05);
    mocks.createNotification.mockResolvedValue({ id: "notification-1" });
    mocks.markAiBudgetWarningPeriod.mockResolvedValue(undefined);
  });

  it("does not execute when the estimated cost exceeds the limit", async () => {
    const error = new Error("limit exceeded");
    mocks.checkAiCostLimit.mockRejectedValue(error);
    const execute = vi.fn();

    await expect(
      runMeteredAiCall({
        userId: "user-1",
        feature: "rule_review",
        estimatedCostUsd: 0.05,
        execute,
      }),
    ).rejects.toThrow("limit exceeded");

    expect(execute).not.toHaveBeenCalled();
    expect(mocks.incrementAiCostUsage).not.toHaveBeenCalled();
  });

  it("increments usage by the actual cost after a successful call", async () => {
    const result = await runMeteredAiCall({
      userId: "user-1",
      feature: "rule_review",
      estimatedCostUsd: 0.05,
      execute: async () => ({ result: { ok: true }, actualCostUsd: 0.031 }),
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.incrementAiCostUsage).toHaveBeenCalledWith({
      userId: "user-1",
      costUsd: 0.031,
    });
  });

  it("uses the feature estimate when the provider has no measured cost", async () => {
    await runMeteredAiCall({
      userId: "user-1",
      feature: "watchlist_review",
      estimatedCostUsd: 0.05,
      execute: async () => ({ result: "done", actualCostUsd: undefined }),
    });

    expect(mocks.checkAiCostLimit).toHaveBeenCalledWith({
      userId: "user-1",
      estimatedNextCostUsd: 0.05,
    });
    expect(mocks.incrementAiCostUsage).toHaveBeenCalledWith({
      userId: "user-1",
      costUsd: 0.05,
    });
  });

  it("sends the 80 percent warning only once per month", async () => {
    mocks.incrementAiCostUsage.mockResolvedValue(0.8);
    const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    mocks.getUserAiBudgetSetting
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ warning_notified_period: currentPeriod });

    const execute = async () => ({ result: "done", actualCostUsd: 0.8 });
    await runMeteredAiCall({
      userId: "user-1",
      feature: "rule_review",
      estimatedCostUsd: 0.05,
      execute,
    });
    await runMeteredAiCall({
      userId: "user-1",
      feature: "rule_review",
      estimatedCostUsd: 0.05,
      execute,
    });

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.markAiBudgetWarningPeriod).toHaveBeenCalledTimes(1);
  });
});
