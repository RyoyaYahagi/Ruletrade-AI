import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getPortfolioCommonRule,
  upsertPortfolioCommonRule,
} from "@/features/portfolio/services/portfolio-rule-service";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

import { createDatabaseClient } from "@/lib/db/database-client";

const mockMaybeSingle = vi.fn();
const mockEqSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEqSelect }));
const mockEqUpdateUser = vi.fn();
const mockEqUpdateId = vi.fn(() => ({ eq: mockEqUpdateUser }));
const mockUpdate = vi.fn(() => ({ eq: mockEqUpdateId }));
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
  insert: mockInsert,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createDatabaseClient).mockResolvedValue({
    from: mockFrom,
  } as never);
});

describe("getPortfolioCommonRule", () => {
  it("returns null when no rule row exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getPortfolioCommonRule({ userId: "user-1" });

    expect(result.rule).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("portfolio_rules");
    expect(mockEqSelect).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("returns the parsed rule when the row exists", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "rule-1",
        user_id: "user-1",
        rule_json: {
          maxPositionPercent: 10,
          targetAllocations: [],
        },
      },
      error: null,
    });

    const result = await getPortfolioCommonRule({ userId: "user-1" });

    expect(result.rule?.maxPositionPercent).toBe(10);
  });

  it("returns null when the stored json is invalid", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "rule-1",
        user_id: "user-1",
        rule_json: { maxPositionPercent: 250 },
      },
      error: null,
    });

    const result = await getPortfolioCommonRule({ userId: "user-1" });

    expect(result.rule).toBeNull();
  });

  it("throws AppError when the query fails", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: new Error("db down"),
    });

    await expect(
      getPortfolioCommonRule({ userId: "user-1" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
    });
  });
});

describe("upsertPortfolioCommonRule", () => {
  const rule = {
    maxPositionPercent: 10,
    targetAllocations: [],
  };

  it("inserts a new row when none exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });

    const result = await upsertPortfolioCommonRule({
      userId: "user-1",
      rule,
    });

    expect(result.rule).toEqual(rule);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      rule_json: rule,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("updates the existing row scoped to the user", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "rule-1" },
      error: null,
    });
    mockEqUpdateUser.mockResolvedValue({ error: null });

    const result = await upsertPortfolioCommonRule({
      userId: "user-1",
      rule,
    });

    expect(result.rule).toEqual(rule);
    expect(mockUpdate).toHaveBeenCalledWith({ rule_json: rule });
    expect(mockEqUpdateId).toHaveBeenCalledWith("id", "rule-1");
    expect(mockEqUpdateUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("throws AppError when the insert fails", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: new Error("insert failed") });

    await expect(
      upsertPortfolioCommonRule({ userId: "user-1", rule }),
    ).rejects.toThrow(AppError);
  });
});
