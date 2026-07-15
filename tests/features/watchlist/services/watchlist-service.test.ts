import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getOrCreateMainWatchlist,
  getWatchlist,
} from "@/features/watchlist/services/watchlist-service";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

import { createDatabaseClient } from "@/lib/db/database-client";

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
  vi.mocked(createDatabaseClient).mockResolvedValue({
    from: mockFrom,
  } as unknown);
});

describe("getOrCreateMainWatchlist", () => {
  it("returns existing watchlist when found", async () => {
    const mockWatchlist = {
      id: "watchlist-1",
      user_id: "user-1",
      name: "Main Watchlist",
      base_currency: "JPY",
    };
    mockMaybeSingle.mockResolvedValue({ data: mockWatchlist, error: null });

    const result = await getOrCreateMainWatchlist({ userId: "user-1" });

    expect(result.watchlist).toEqual(mockWatchlist);
    expect(mockFrom).toHaveBeenCalledWith("watchlists");
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

  it("creates new watchlist when none exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const mockCreated = {
      id: "watchlist-new",
      user_id: "user-1",
      name: "Main Watchlist",
      base_currency: "JPY",
    };
    mockSingle.mockResolvedValue({ data: mockCreated, error: null });

    const result = await getOrCreateMainWatchlist({ userId: "user-1" });

    expect(result.watchlist).toEqual(mockCreated);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      name: "Main Watchlist",
      base_currency: "JPY",
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
      getOrCreateMainWatchlist({ userId: "user-1" }),
    ).rejects.toThrow(AppError);
    await expect(
      getOrCreateMainWatchlist({ userId: "user-1" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Watchlistの取得に失敗しました。",
    });
  });

  it("throws AppError when insert query fails", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error("Insert failed"),
    });

    await expect(
      getOrCreateMainWatchlist({ userId: "user-1" }),
    ).rejects.toThrow(AppError);
    await expect(
      getOrCreateMainWatchlist({ userId: "user-1" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Watchlistの作成に失敗しました。",
    });
  });
});

describe("getWatchlist", () => {
  it("delegates to getOrCreateMainWatchlist and returns watchlist", async () => {
    const mockWatchlist = {
      id: "watchlist-1",
      user_id: "user-1",
      name: "Main Watchlist",
      base_currency: "JPY",
    };
    mockMaybeSingle.mockResolvedValue({ data: mockWatchlist, error: null });

    const result = await getWatchlist({ userId: "user-1" });

    expect(result.watchlist).toEqual(mockWatchlist);
    expect(mockFrom).toHaveBeenCalledWith("watchlists");
  });
});
