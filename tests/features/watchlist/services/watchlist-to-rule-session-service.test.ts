import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRuleSessionFromWatchlistItem } from "@/features/watchlist/services/watchlist-to-rule-session-service";
import { AppError } from "@/lib/errors/app-error";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/supabase-server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/features/rules/services/rule-session-service", () => ({
  createRuleSession: vi.fn(),
}));

import { createServerClient } from "@/lib/db/supabase-server";
import { createRuleSession } from "@/features/rules/services/rule-session-service";

// ---------------------------------------------------------------------------
// Supabase query-builder mock chain
//
// The source under test makes three calls via the supabase client:
//   1) from("watchlist_items").select("*").eq("id",…).eq("user_id",…).single()
//   2) from("rule_design_sessions").update(…).eq("id",…).eq("user_id",…)
//   3) from("watchlist_items").update(…).eq("id",…).eq("user_id",…)
// ---------------------------------------------------------------------------

// -- select chain: select() → eq() → eq() → single()
const mockSingle = vi.fn();
const mockEqSelectB = vi.fn(() => ({ single: mockSingle })); // 2nd .eq() returns { single: … }
const mockEqSelectA = vi.fn(() => ({ eq: mockEqSelectB })); // 1st .eq() returns { eq: … }
const mockSelect = vi.fn(() => ({ eq: mockEqSelectA })); // .select("*") returns { eq: … }

// -- update chain: update() → eq() → eq()
const mockEqUpdateC = vi.fn();
const mockEqUpdateB = vi.fn(() => ({ eq: mockEqUpdateC }));
const mockUpdate = vi.fn(() => ({ eq: mockEqUpdateB }));

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

const mockSupabase = { from: mockFrom };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerClient).mockResolvedValue(
    mockSupabase as unknown as never,
  );
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockItem = {
  id: "item-1",
  user_id: "user-1",
  ticker: "AAPL",
  company_name: "Apple Inc.",
  market: "US",
  currency: "USD",
  interest_reason: "Strong growth thesis",
  target_price_min: 150,
  target_price_max: 200,
  planned_tranches: 3,
  max_position_percent: 10,
  stop_loss_note: "Stop at 120",
  target_multiple: 2.0,
  take_profit_note: "Take profit at 250",
  earnings_note: "Watch Q3 earnings",
  research_notes: "Strong buy candidate; recurring revenue growing",
  status: "watchlist",
  rule_session_id: null,
};

const mockSessionResult = { sessionId: "session-1" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createRuleSessionFromWatchlistItem", () => {
  // ── 正常系 ──────────────────────────────────────────────────────────────
  it("正常系: itemからrule sessionが作成され、関連レコードが更新される", async () => {
    mockSingle.mockResolvedValueOnce({ data: mockItem, error: null });
    vi.mocked(createRuleSession).mockResolvedValueOnce(mockSessionResult);

    const result = await createRuleSessionFromWatchlistItem({
      userId: "user-1",
      itemId: "item-1",
    });

    // Returns the session id
    expect(result).toEqual({ sessionId: "session-1" });

    // 1) createRuleSession called with mapped fields
    expect(createRuleSession).toHaveBeenCalledWith({
      userId: "user-1",
      ticker: "AAPL",
      companyName: "Apple Inc.",
      market: "US",
      currency: "USD",
      templateKey: "watchlist-item",
    });

    // 2) rule_design_sessions updated with rule_json
    expect(mockFrom).toHaveBeenNthCalledWith(1, "watchlist_items");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEqSelectA).toHaveBeenCalledWith("id", "item-1");
    expect(mockEqSelectB).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockSingle).toHaveBeenCalled();

    expect(mockFrom).toHaveBeenNthCalledWith(2, "rule_design_sessions");
    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      rule_json: {
        investmentThesis: "Strong growth thesis",
        entryPlan: {
          targetPriceMin: 150,
          targetPriceMax: 200,
          tranches: 3,
          currency: "USD",
        },
        riskManagement: {
          maxPositionPercent: 10,
          stopLossRule: "Stop at 120",
        },
        exitPlan: {
          targetMultiple: 2.0,
          takeProfitRule: "Take profit at 250",
        },
        earningsPolicy: {
          policy: "undecided",
          notes: "Watch Q3 earnings",
        },
        freeNotes: "Strong buy candidate; recurring revenue growing",
      },
    });
    expect(mockEqUpdateB).toHaveBeenNthCalledWith(1, "id", "session-1"); // rule_design_sessions .eq("id", sessionId)
    expect(mockEqUpdateC).toHaveBeenNthCalledWith(1, "user_id", "user-1"); // rule_design_sessions .eq("user_id", userId)

    // 3) watchlist_items updated with status + rule_session_id
    expect(mockFrom).toHaveBeenNthCalledWith(3, "watchlist_items");
    expect(mockUpdate).toHaveBeenNthCalledWith(2, {
      status: "rule_designing",
      rule_session_id: "session-1",
    });
    expect(mockEqUpdateB).toHaveBeenNthCalledWith(2, "id", "item-1"); // watchlist_items .eq("id", itemId)
    expect(mockEqUpdateC).toHaveBeenNthCalledWith(2, "user_id", "user-1"); // watchlist_items .eq("user_id", userId)
  });

  // ── item が見つからない ──────────────────────────────────────────────────
  it("itemが見つからない場合、404 AppErrorがスローされる", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      createRuleSessionFromWatchlistItem({
        userId: "user-1",
        itemId: "nonexistent",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Watchlist itemが見つかりません。",
    });
  });

  it("DBエラーが返った場合も404 AppErrorがスローされる", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: new Error("DB connection lost"),
    });

    await expect(
      createRuleSessionFromWatchlistItem({
        userId: "user-1",
        itemId: "item-1",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Watchlist itemが見つかりません。",
    });
  });

  // ── createRuleSession の引数 ────────────────────────────────────────────
  it("createRuleSessionの呼び出し引数が正しい（nullフィールドはundefined/fallbackに変換される）", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "item-2",
        user_id: "user-1",
        ticker: "TSLA",
        company_name: null,
        market: null,
        currency: null,
        interest_reason: null,
        target_price_min: null,
        target_price_max: null,
        planned_tranches: null,
        max_position_percent: null,
        stop_loss_note: null,
        target_multiple: null,
        take_profit_note: null,
        earnings_note: null,
        research_notes: null,
      },
      error: null,
    });
    vi.mocked(createRuleSession).mockResolvedValueOnce(mockSessionResult);

    await createRuleSessionFromWatchlistItem({
      userId: "user-1",
      itemId: "item-2",
    });

    // null fields become undefined; currency falls back to "JPY"
    expect(createRuleSession).toHaveBeenCalledWith({
      userId: "user-1",
      ticker: "TSLA",
      companyName: undefined,
      market: undefined,
      currency: "JPY",
      templateKey: "watchlist-item",
    });
  });

  // ── rule_json のマッピング ──────────────────────────────────────────────
  it("rule_jsonの内容が正しい（itemの全フィールドが正しくマッピングされる）", async () => {
    mockSingle.mockResolvedValueOnce({ data: mockItem, error: null });
    vi.mocked(createRuleSession).mockResolvedValueOnce(mockSessionResult);

    await createRuleSessionFromWatchlistItem({
      userId: "user-1",
      itemId: "item-1",
    });

    // Assert the full rule_json structure passed to the update call
    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      rule_json: {
        investmentThesis: "Strong growth thesis",
        entryPlan: {
          targetPriceMin: 150,
          targetPriceMax: 200,
          tranches: 3,
          currency: "USD",
        },
        riskManagement: {
          maxPositionPercent: 10,
          stopLossRule: "Stop at 120",
        },
        exitPlan: {
          targetMultiple: 2.0,
          takeProfitRule: "Take profit at 250",
        },
        earningsPolicy: {
          policy: "undecided",
          notes: "Watch Q3 earnings",
        },
        freeNotes: "Strong buy candidate; recurring revenue growing",
      },
    });
  });

  it("null項目がundefinedとしてマッピングされる", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "item-3",
        user_id: "user-1",
        ticker: "MSFT",
        company_name: null,
        market: null,
        currency: null,
        interest_reason: null,
        target_price_min: null,
        target_price_max: null,
        planned_tranches: null,
        max_position_percent: null,
        stop_loss_note: null,
        target_multiple: null,
        take_profit_note: null,
        earnings_note: null,
        research_notes: null,
      },
      error: null,
    });
    vi.mocked(createRuleSession).mockResolvedValueOnce(mockSessionResult);

    await createRuleSessionFromWatchlistItem({
      userId: "user-1",
      itemId: "item-3",
    });

    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      rule_json: {
        investmentThesis: undefined,
        entryPlan: {
          targetPriceMin: undefined,
          targetPriceMax: undefined,
          tranches: undefined,
          currency: "JPY", // fallback
        },
        riskManagement: {
          maxPositionPercent: undefined,
          stopLossRule: undefined,
        },
        exitPlan: {
          targetMultiple: undefined,
          takeProfitRule: undefined,
        },
        earningsPolicy: {
          policy: "undecided",
          notes: undefined,
        },
        freeNotes: undefined,
      },
    });
  });
});
