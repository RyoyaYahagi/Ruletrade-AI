import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listPortfolioPositions,
  createPortfolioPosition,
  createPortfolioPositions,
} from "@/features/portfolio/services/portfolio-position-service";
import { AppError } from "@/lib/errors/app-error";

// Mock getOrCreateMainPortfolio
vi.mock("@/features/portfolio/services/portfolio-service", () => ({
  getOrCreateMainPortfolio: vi.fn(),
}));

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

vi.mock("@/features/portfolio/services/portfolio-aggregation-service", () => ({
  applyLatestQuotesToPositions: vi.fn(async ({ positions }) => positions),
}));

import { createDatabaseClient } from "@/lib/db/database-client";
import { getOrCreateMainPortfolio } from "@/features/portfolio/services/portfolio-service";

// ---- Chain for list (select -> eq -> neq -> order) ----
const mockOrderList = vi.fn();
const mockNeqList = vi.fn(() => ({ order: mockOrderList }));
const mockEqList = vi.fn(() => ({ neq: mockNeqList }));
const mockSelectList = vi.fn(() => ({ eq: mockEqList }));

// ---- Chain for create (insert -> select -> single) ----
const mockSingleCreate = vi.fn();
const mockSelectCreate = vi.fn(() => ({ single: mockSingleCreate }));
const mockInsert = vi.fn(() => ({ select: mockSelectCreate }));

// ---- from ----
const mockFrom = vi.fn((table: string) => {
  if (table === "portfolio_positions") {
    return { select: mockSelectList, insert: mockInsert };
  }
  return { select: mockSelectList };
});

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(createDatabaseClient).mockResolvedValue({
    from: mockFrom,
  } as unknown);

  vi.mocked(getOrCreateMainPortfolio).mockResolvedValue({
    portfolio: {
      id: "portfolio-1",
      user_id: "user-1",
      name: "Main Portfolio",
      base_currency: "JPY",
      cash_amount: 100000,
    },
  });
});

describe("listPortfolioPositions", () => {
  it("returns positions filtered by user_id and not archived", async () => {
    const mockPositions = [
      {
        id: "pos-1",
        user_id: "user-1",
        ticker: "7203.T",
        market_value: 50000,
        position_status: "active",
      },
      {
        id: "pos-2",
        user_id: "user-1",
        ticker: "9984.T",
        market_value: 30000,
        position_status: "active",
      },
    ];
    mockOrderList.mockResolvedValue({ data: mockPositions, error: null });

    const result = await listPortfolioPositions({ userId: "user-1" });

    expect(result.positions).toEqual(mockPositions);
    expect(mockFrom).toHaveBeenCalledWith("portfolio_positions");
    expect(mockSelectList).toHaveBeenCalledWith("*");
    expect(mockEqList).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockNeqList).toHaveBeenCalledWith("position_status", "archived");
    expect(mockOrderList).toHaveBeenCalledWith("market_value", {
      ascending: false,
    });
  });

  it("returns empty array when no positions found", async () => {
    mockOrderList.mockResolvedValue({ data: null, error: null });

    const result = await listPortfolioPositions({ userId: "user-1" });

    expect(result.positions).toEqual([]);
  });

  it("throws AppError when query fails", async () => {
    mockOrderList.mockResolvedValue({
      data: null,
      error: new Error("Query error"),
    });

    await expect(listPortfolioPositions({ userId: "user-1" })).rejects.toThrow(
      AppError,
    );
    await expect(
      listPortfolioPositions({ userId: "user-1" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
    });
  });
});

describe("createPortfolioPosition", () => {
  const baseParams = {
    userId: "user-1",
    ticker: "7203.T",
    currency: "JPY",
    assetType: "stock",
    marketValue: 50000,
  };

  it("creates a position and returns it", async () => {
    const mockCreated = {
      id: "pos-new",
      user_id: "user-1",
      portfolio_id: "portfolio-1",
      ticker: "7203.T",
      currency: "JPY",
      asset_type: "stock",
      market_value: 50000,
      position_status: "active",
    };
    mockSingleCreate.mockResolvedValue({ data: mockCreated, error: null });

    const result = await createPortfolioPosition(baseParams);

    expect(result.position).toEqual(mockCreated);
    expect(getOrCreateMainPortfolio).toHaveBeenCalledWith({
      userId: "user-1",
    });
    expect(mockFrom).toHaveBeenCalledWith("portfolio_positions");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      portfolio_id: "portfolio-1",
      ticker: "7203.T",
      company_name: null,
      market: null,
      currency: "JPY",
      asset_type: "stock",
      sector: null,
      theme: null,
      quantity: null,
      average_cost: null,
      current_price: null,
      market_value: 50000,
      target_weight_percent: null,
      rule_session_id: null,
      position_status: "active",
      memo: null,
    });
    expect(mockSelectCreate).toHaveBeenCalledWith("*");
    expect(mockSingleCreate).toHaveBeenCalled();
  });

  it("passes optional fields to insert", async () => {
    const params = {
      ...baseParams,
      companyName: "Toyota Motor Corp",
      market: "JP" as const,
      sector: "Automotive" as const,
      theme: "EV" as const,
      quantity: 100,
      averageCost: 48000,
      currentPrice: 50000,
      targetWeightPercent: 10,
      ruleSessionId: "session-1",
      positionStatus: "active" as const,
      memo: "Test memo",
    };
    const mockCreated = { id: "pos-new", ...params, market_value: 50000 };
    mockSingleCreate.mockResolvedValue({ data: mockCreated, error: null });

    await createPortfolioPosition(params);

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      portfolio_id: "portfolio-1",
      ticker: "7203.T",
      company_name: "Toyota Motor Corp",
      market: "JP",
      currency: "JPY",
      asset_type: "stock",
      sector: "Automotive",
      theme: "EV",
      quantity: 100,
      average_cost: 48000,
      current_price: 50000,
      market_value: 50000,
      target_weight_percent: 10,
      rule_session_id: "session-1",
      position_status: "active",
      memo: "Test memo",
    });
  });

  it("throws AppError when insert fails", async () => {
    mockSingleCreate.mockResolvedValue({
      data: null,
      error: new Error("Insert error"),
    });

    await expect(createPortfolioPosition(baseParams)).rejects.toThrow(AppError);
    await expect(createPortfolioPosition(baseParams)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
    });
  });

  it("throws AppError when data is null after insert", async () => {
    mockSingleCreate.mockResolvedValue({ data: null, error: null });

    await expect(createPortfolioPosition(baseParams)).rejects.toThrow(AppError);
  });

  it("一括追加では投資信託のコードがない行にも内部識別子を付ける", async () => {
    mockInsert.mockResolvedValueOnce({ data: null, error: null });

    const result = await createPortfolioPositions({
      userId: "user-1",
      positions: [
        {
          companyName: "国内株式インデックスファンド",
          currency: "JPY",
          assetType: "fund",
          marketValue: 30000,
        },
      ],
    });

    expect(result.count).toBe(1);
    expect(mockInsert).toHaveBeenLastCalledWith([
      expect.objectContaining({
        ticker: expect.stringMatching(/^FUND-[a-f0-9]{16}$/),
        company_name: "国内株式インデックスファンド",
        asset_type: "fund",
        market_value: 30000,
      }),
    ]);
  });
});
