import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listWatchlistItems,
  createWatchlistItem,
  getWatchlistItem,
  updateWatchlistItem,
  deleteWatchlistItem,
} from "@/features/watchlist/services/watchlist-item-service";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

import { createDatabaseClient } from "@/lib/db/database-client";

// ── Shared terminal mocks ──
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();

// ── Chain: .select().eq().neq().order() (for listWatchlistItems) ──
let mockOrderResult: unknown;
const mockOrderList = vi.fn(() => mockOrderResult);
const mockNeqList = vi.fn(() => ({ order: mockOrderList }));
const mockEqList = vi.fn(() => ({ neq: mockNeqList }));

// ── Chain: .select().eq1().eq2().single() (for getWatchlistItem, ownership checks) ──
const mockEq2Get = vi.fn(() => ({ single: mockSingle }));
const mockEq1Get = vi.fn(() => ({ eq: mockEq2Get, neq: mockNeqList }));

// ── Chain: .select() start (used for most watchlist_items queries) ──
const mockSelect = vi.fn(() => ({ eq: mockEq1Get }));

// ── Chain: .insert().select().single() ──
const mockSelectInsert = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelectInsert }));

// ── Chain: .update().eq().select().single() ──
const mockUpdateSingle = vi.fn();
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }));
const mockUpdateEq = vi.fn(() => ({ select: mockUpdateSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));

// ── Chain: .delete().eq() (terminal returns data directly) ──
let mockDeleteResult: unknown;
const mockDeleteEq = vi.fn(() => mockDeleteResult);
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));

// ── Watchlist chain (for getOrCreateMainWatchlist internals) ──
const mockLimitWL = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockOrderWL = vi.fn(() => ({ limit: mockLimitWL }));
const mockEqWL = vi.fn(() => ({ order: mockOrderWL }));
const mockSelectWL = vi.fn(() => ({ eq: mockEqWL }));
const mockSelectCreateWL = vi.fn(() => ({ single: mockSingle }));
const mockInsertWL = vi.fn(() => ({ select: mockSelectCreateWL }));

// ── from() ──
const mockFrom = vi.fn((table: string) => {
  if (table === "watchlists") {
    return {
      select: mockSelectWL,
      insert: mockInsertWL,
    };
  }
  // table === "watchlist_items"
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createDatabaseClient).mockResolvedValue({
    from: mockFrom,
  } as unknown);
});

describe("listWatchlistItems", () => {
  it("returns only the current user's items", async () => {
    const mockItems = [
      { id: "item-1", user_id: "user-1", ticker: "AAPL", status: "watching" },
      { id: "item-2", user_id: "user-1", ticker: "TSLA", status: "watching" },
    ];
    mockOrderResult = { data: mockItems, error: null };

    const result = await listWatchlistItems({ userId: "user-1" });

    expect(result.items).toEqual(mockItems);
    expect(mockFrom).toHaveBeenCalledWith("watchlist_items");
    expect(mockEq1Get).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockNeqList).toHaveBeenCalledWith("status", "archived");
    expect(mockOrderList).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
  });

  it("excludes archived items", async () => {
    const activeItems = [
      { id: "item-1", user_id: "user-1", ticker: "AAPL", status: "watching" },
    ];
    mockOrderResult = { data: activeItems, error: null };

    const result = await listWatchlistItems({ userId: "user-1" });

    expect(result.items).toEqual(activeItems);
    expect(mockNeqList).toHaveBeenCalledWith("status", "archived");
  });

  it("returns empty array when no items exist", async () => {
    mockOrderResult = { data: null, error: null };

    const result = await listWatchlistItems({ userId: "user-1" });

    expect(result.items).toEqual([]);
  });

  it("throws AppError when query fails", async () => {
    mockOrderResult = {
      data: null,
      error: new Error("DB error"),
    };

    await expect(listWatchlistItems({ userId: "user-1" })).rejects.toThrow(
      AppError,
    );
    await expect(
      listWatchlistItems({ userId: "user-1" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Watchlist item一覧の取得に失敗しました。",
    });
  });
});

describe("createWatchlistItem", () => {
  it("creates a watchlist item successfully", async () => {
    const mockWatchlist = {
      id: "watchlist-1",
      user_id: "user-1",
      name: "Main Watchlist",
      base_currency: "JPY",
    };
    mockMaybeSingle.mockResolvedValue({ data: mockWatchlist, error: null });

    const mockCreatedItem = {
      id: "item-new",
      user_id: "user-1",
      watchlist_id: "watchlist-1",
      ticker: "AAPL",
      currency: "USD",
      company_name: null,
      market: null,
      status: "watching",
      priority: "medium",
      interest_reason: null,
      target_price_min: null,
      target_price_max: null,
      planned_tranches: null,
      target_multiple: null,
      max_position_percent: null,
      stop_loss_note: null,
      take_profit_note: null,
      earnings_note: null,
      research_notes: null,
      tags: [],
      rule_session_id: null,
    };
    mockSingle.mockResolvedValue({ data: mockCreatedItem, error: null });

    const result = await createWatchlistItem({
      userId: "user-1",
      ticker: "AAPL",
      currency: "USD",
    });

    expect(result.item).toEqual(mockCreatedItem);
    // Should have looked up the watchlist
    expect(mockFrom).toHaveBeenCalledWith("watchlists");
    expect(mockSelectWL).toHaveBeenCalledWith("*");
    expect(mockEqWL).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      watchlist_id: "watchlist-1",
      ticker: "AAPL",
      company_name: null,
      market: null,
      currency: "USD",
      status: "watching",
      priority: "medium",
      interest_reason: null,
      target_price_min: null,
      target_price_max: null,
      planned_tranches: null,
      target_multiple: null,
      max_position_percent: null,
      stop_loss_note: null,
      take_profit_note: null,
      earnings_note: null,
      research_notes: null,
      tags: [],
      rule_session_id: null,
    });
  });

  it("throws AppError when insert fails", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "watchlist-1",
        user_id: "user-1",
        name: "Main Watchlist",
        base_currency: "JPY",
      },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error("Insert failed"),
    });

    await expect(
      createWatchlistItem({
        userId: "user-1",
        ticker: "AAPL",
        currency: "USD",
      }),
    ).rejects.toThrow(AppError);
    await expect(
      createWatchlistItem({
        userId: "user-1",
        ticker: "AAPL",
        currency: "USD",
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Watchlist itemの追加に失敗しました。",
    });
  });

  it("preserves provided optional fields", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "watchlist-1",
        user_id: "user-1",
        name: "Main Watchlist",
        base_currency: "JPY",
      },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: {
        id: "item-new",
        ticker: "AAPL",
        company_name: "Apple Inc.",
        market: "US",
        currency: "USD",
        status: "analyzing",
        priority: "high",
        interest_reason: "Strong fundamentals",
        target_price_min: 150,
        target_price_max: 200,
        planned_tranches: 3,
        target_multiple: 25,
        max_position_percent: 10,
        stop_loss_note: "Stop at 10%",
        take_profit_note: "Take profit at 20%",
        research_notes: "Great company",
        tags: ["tech", "growth"],
        rule_session_id: "session-1",
        user_id: "user-1",
        watchlist_id: "watchlist-1",
      },
      error: null,
    });

    const result = await createWatchlistItem({
      userId: "user-1",
      ticker: "AAPL",
      currency: "USD",
      companyName: "Apple Inc.",
      market: "US",
      status: "analyzing",
      priority: "high",
      interestReason: "Strong fundamentals",
      targetPriceMin: 150,
      targetPriceMax: 200,
      plannedTranches: 3,
      targetMultiple: 25,
      maxPositionPercent: 10,
      stopLossNote: "Stop at 10%",
      takeProfitNote: "Take profit at 20%",
      researchNotes: "Great company",
      tags: ["tech", "growth"],
      ruleSessionId: "session-1",
    });

    expect(result.item.company_name).toBe("Apple Inc.");
    expect(result.item.market).toBe("US");
    expect(result.item.target_price_min).toBe(150);
    expect(result.item.target_price_max).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: "Apple Inc.",
        market: "US",
        status: "analyzing",
        priority: "high",
        interest_reason: "Strong fundamentals",
        target_price_min: 150,
        target_price_max: 200,
        planned_tranches: 3,
        target_multiple: 25,
        max_position_percent: 10,
        stop_loss_note: "Stop at 10%",
        take_profit_note: "Take profit at 20%",
        research_notes: "Great company",
        tags: ["tech", "growth"],
        rule_session_id: "session-1",
      }),
    );
  });
});

describe("getWatchlistItem", () => {
  it("returns the item when found", async () => {
    const mockItem = {
      id: "item-1",
      user_id: "user-1",
      ticker: "AAPL",
      currency: "USD",
      status: "watching",
    };
    mockSingle.mockResolvedValue({ data: mockItem, error: null });

    const result = await getWatchlistItem({
      userId: "user-1",
      itemId: "item-1",
    });

    expect(result.item).toEqual(mockItem);
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEq1Get).toHaveBeenCalledWith("id", "item-1");
    expect(mockEq2Get).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockSingle).toHaveBeenCalled();
  });

  it("throws 404 AppError when item is not found", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error("Not found"),
    });

    await expect(
      getWatchlistItem({ userId: "user-1", itemId: "nonexistent" }),
    ).rejects.toThrow(AppError);
    await expect(
      getWatchlistItem({ userId: "user-1", itemId: "nonexistent" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Watchlist itemが見つかりませんでした。",
    });
  });

  it("throws 404 when item belongs to another user", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error("Not found"),
    });

    await expect(
      getWatchlistItem({ userId: "user-2", itemId: "item-1" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    // Should filter by both item ID and user ID
    expect(mockEq1Get).toHaveBeenCalledWith("id", "item-1");
    expect(mockEq2Get).toHaveBeenCalledWith("user_id", "user-2");
  });
});

describe("updateWatchlistItem", () => {
  it("updates an item successfully", async () => {
    // First call: ownership check — .single() resolves with existing item id
    mockSingle.mockResolvedValue({
      data: { id: "item-1" },
      error: null,
    });
    // Second call: update — .updateSingle() resolves with updated item
    const mockUpdated = {
      id: "item-1",
      user_id: "user-1",
      ticker: "AAPL",
      currency: "USD",
      status: "analyzing",
    };
    mockUpdateSingle.mockResolvedValue({ data: mockUpdated, error: null });

    const result = await updateWatchlistItem({
      userId: "user-1",
      itemId: "item-1",
      status: "analyzing",
    });

    expect(result.item).toEqual(mockUpdated);
    // Ownership check
    expect(mockSelect).toHaveBeenCalledWith("id");
    expect(mockEq1Get).toHaveBeenCalledWith("id", "item-1");
    expect(mockEq2Get).toHaveBeenCalledWith("user_id", "user-1");
    // Update
    expect(mockUpdate).toHaveBeenCalledWith({ status: "analyzing" });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "item-1");
  });

  it("throws 404 when the item does not exist", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error("Not found"),
    });

    await expect(
      updateWatchlistItem({
        userId: "user-1",
        itemId: "nonexistent",
        status: "analyzing",
      }),
    ).rejects.toThrow(AppError);
    await expect(
      updateWatchlistItem({
        userId: "user-1",
        itemId: "nonexistent",
        status: "analyzing",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Watchlist itemが見つかりませんでした。",
    });
  });

  it("does not allow updating another user's item", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error("Not found"),
    });

    await expect(
      updateWatchlistItem({
        userId: "user-2",
        itemId: "item-1",
        status: "analyzing",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    // Should filter by both item ID and user ID
    expect(mockEq1Get).toHaveBeenCalledWith("id", "item-1");
    expect(mockEq2Get).toHaveBeenCalledWith("user_id", "user-2");
  });

  it("throws AppError when update query fails", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "item-1" },
      error: null,
    });
    mockUpdateSingle.mockResolvedValue({
      data: null,
      error: new Error("Update failed"),
    });

    await expect(
      updateWatchlistItem({
        userId: "user-1",
        itemId: "item-1",
        status: "analyzing",
      }),
    ).rejects.toThrow(AppError);
    await expect(
      updateWatchlistItem({
        userId: "user-1",
        itemId: "item-1",
        status: "analyzing",
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Watchlist itemの更新に失敗しました。",
    });
  });

  it("updates only specified fields", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "item-1" },
      error: null,
    });
    mockUpdateSingle.mockResolvedValue({
      data: {
        id: "item-1",
        ticker: "AAPL",
        status: "watching",
        priority: "high",
      },
      error: null,
    });

    await updateWatchlistItem({
      userId: "user-1",
      itemId: "item-1",
      priority: "high",
    });

    // Should only include the provided field in update data
    expect(mockUpdate).toHaveBeenCalledWith({ priority: "high" });
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.anything() }),
    );
  });
});

describe("deleteWatchlistItem", () => {
  it("deletes an item successfully", async () => {
    // Ownership check succeeds
    mockSingle.mockResolvedValue({
      data: { id: "item-1" },
      error: null,
    });
    // Delete succeeds
    mockDeleteResult = { data: null, error: null };

    await deleteWatchlistItem({ userId: "user-1", itemId: "item-1" });

    expect(mockSelect).toHaveBeenCalledWith("id");
    expect(mockEq1Get).toHaveBeenCalledWith("id", "item-1");
    expect(mockEq2Get).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockDelete).toHaveBeenCalledWith();
    expect(mockDeleteEq).toHaveBeenCalledWith("id", "item-1");
  });

  it("throws 404 when the item does not exist", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error("Not found"),
    });

    await expect(
      deleteWatchlistItem({ userId: "user-1", itemId: "nonexistent" }),
    ).rejects.toThrow(AppError);
    await expect(
      deleteWatchlistItem({ userId: "user-1", itemId: "nonexistent" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("does not allow deleting another user's item", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error("Not found"),
    });

    await expect(
      deleteWatchlistItem({ userId: "user-2", itemId: "item-1" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    expect(mockEq1Get).toHaveBeenCalledWith("id", "item-1");
    expect(mockEq2Get).toHaveBeenCalledWith("user_id", "user-2");
  });

  it("throws AppError when delete query fails", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "item-1" },
      error: null,
    });
    mockDeleteResult = {
      data: null,
      error: new Error("Delete failed"),
    };

    await expect(
      deleteWatchlistItem({ userId: "user-1", itemId: "item-1" }),
    ).rejects.toThrow(AppError);
    await expect(
      deleteWatchlistItem({ userId: "user-1", itemId: "item-1" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Watchlist itemの削除に失敗しました。",
    });
  });
});
