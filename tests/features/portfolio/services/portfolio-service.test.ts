import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getOrCreateMainPortfolio,
  getPortfolio,
} from "@/features/portfolio/services/portfolio-service";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/db/supabase-server", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/db/supabase-server";

const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockOrderFind = vi.fn(() => ({ limit: mockLimit }));
const mockEqFind = vi.fn(() => ({ order: mockOrderFind }));
const mockSelect = vi.fn(() => ({ eq: mockEqFind }));
const mockSelectCreate = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelectCreate }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerClient).mockResolvedValue({
    from: mockFrom,
  } as unknown);
});

describe("getOrCreateMainPortfolio", () => {
  it("returns existing portfolio when found", async () => {
    const mockPortfolio = {
      id: "portfolio-1",
      user_id: "user-1",
      name: "Main Portfolio",
      base_currency: "JPY",
      cash_amount: 0,
    };
    mockMaybeSingle.mockResolvedValue({ data: mockPortfolio, error: null });

    const result = await getOrCreateMainPortfolio({ userId: "user-1" });

    expect(result.portfolio).toEqual(mockPortfolio);
    expect(mockFrom).toHaveBeenCalledWith("portfolios");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEqFind).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockOrderFind).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(mockMaybeSingle).toHaveBeenCalled();
    // Should NOT try to insert
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates new portfolio when none exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const mockCreated = {
      id: "portfolio-new",
      user_id: "user-1",
      name: "Main Portfolio",
      base_currency: "JPY",
      cash_amount: 0,
    };
    mockSingle.mockResolvedValue({ data: mockCreated, error: null });

    const result = await getOrCreateMainPortfolio({ userId: "user-1" });

    expect(result.portfolio).toEqual(mockCreated);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      name: "Main Portfolio",
      base_currency: "JPY",
      cash_amount: 0,
    });
    expect(mockSelectCreate).toHaveBeenCalledWith("*");
    expect(mockSingle).toHaveBeenCalled();
  });

  it("throws AppError when find query fails with database error", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: new Error("DB connection error"),
    });

    await expect(
      getOrCreateMainPortfolio({ userId: "user-1" }),
    ).rejects.toThrow(AppError);
    await expect(
      getOrCreateMainPortfolio({ userId: "user-1" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "ポートフォリオの取得に失敗しました。",
    });
  });

  it("throws AppError when insert query fails", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error("Insert failed"),
    });

    await expect(
      getOrCreateMainPortfolio({ userId: "user-1" }),
    ).rejects.toThrow(AppError);
    await expect(
      getOrCreateMainPortfolio({ userId: "user-1" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "ポートフォリオの作成に失敗しました。",
    });
  });
});

describe("getPortfolio", () => {
  it("delegates to getOrCreateMainPortfolio and returns portfolio", async () => {
    const mockPortfolio = {
      id: "portfolio-1",
      user_id: "user-1",
      name: "Main Portfolio",
      base_currency: "JPY",
      cash_amount: 0,
    };
    mockMaybeSingle.mockResolvedValue({ data: mockPortfolio, error: null });

    const result = await getPortfolio({ userId: "user-1" });

    expect(result.portfolio).toEqual(mockPortfolio);
    expect(mockFrom).toHaveBeenCalledWith("portfolios");
  });
});
