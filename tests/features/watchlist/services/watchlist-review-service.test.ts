import { describe, expect, it, vi, beforeEach } from "vitest";
import { runWatchlistReview } from "@/features/watchlist/services/watchlist-review-service";
import { AppError } from "@/lib/errors/app-error";

// ── Mock dependencies ────────────────────────────────────────────────────────

vi.mock("@/lib/db/supabase-server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/ai/provider-factory", () => ({
  getAIProvider: vi.fn(),
}));

vi.mock("@/lib/safety/safety-check-service", () => ({
  runSafetyCheck: vi.fn(),
}));

vi.mock("@/features/watchlist/prompts/watchlist-review-prompt", () => ({
  buildWatchlistReviewPrompt: vi.fn(),
  WATCHLIST_REVIEW_PROMPT_VERSION: "watchlist-reviewer-v1",
}));

import { createServerClient } from "@/lib/db/supabase-server";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { buildWatchlistReviewPrompt } from "@/features/watchlist/prompts/watchlist-review-prompt";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const userId = "user-1";
const watchlistId = "watchlist-1";

const mockWatchlist = {
  id: watchlistId,
  user_id: userId,
  name: "Test Watchlist",
  created_at: "2025-01-01T00:00:00Z",
};

const mockItems = [
  {
    id: "item-1",
    user_id: userId,
    watchlist_id: watchlistId,
    ticker: "AAPL",
    status: "active",
    updated_at: "2025-03-01T00:00:00Z",
  },
  {
    id: "item-2",
    user_id: userId,
    watchlist_id: watchlistId,
    ticker: "GOOGL",
    status: "active",
    updated_at: "2025-03-02T00:00:00Z",
  },
];

const mockAiReview = {
  summary: "Well-structured watchlist with clear investment themes.",
  readinessScore: 78,
  needsMoreInfo: false,
  canCreateRuleSession: true,
  qualityChecks: [
    {
      checkKey: "entry_exit_missing",
      label: "Entry/Exit Conditions",
      status: "warning",
      severity: "medium",
      reason: "AAPL has no defined exit criteria",
      relatedTickers: ["AAPL"],
      suggestedQuestion: "What is your exit strategy for AAPL?",
    },
  ],
  followUpQuestions: [
    {
      questionKey: "investment_horizon",
      questionText: "What is your expected holding period for these positions?",
      relatedTickers: [],
    },
  ],
  suggestedRuleSessionTargets: [
    { ticker: "AAPL", reason: "Ready for rule creation" },
  ],
};

const mockAiResult = {
  data: mockAiReview,
  meta: {
    provider: "mock",
    model: "mock-model",
    promptVersion: "watchlist-reviewer-v1",
    latencyMs: 150,
  },
  usage: {
    inputTokens: 120,
    outputTokens: 200,
    estimatedCostUsd: 0.002,
  },
};

// ── Mock chain helpers ───────────────────────────────────────────────────────

let mockWatchlistSingle: ReturnType<typeof vi.fn>;
let mockWatchlistLimit: ReturnType<typeof vi.fn>;
let mockWatchlistOrder: ReturnType<typeof vi.fn>;
let mockWatchlistEqUserId: ReturnType<typeof vi.fn>;
let mockWatchlistSelect: ReturnType<typeof vi.fn>;

let mockItemsOrder: ReturnType<typeof vi.fn>;
let mockItemsEqId: ReturnType<typeof vi.fn>;
let mockItemsNeq: ReturnType<typeof vi.fn>;
let mockItemsEqWatchlistId: ReturnType<typeof vi.fn>;
let mockItemsEqUserId: ReturnType<typeof vi.fn>;
let mockItemsSelect: ReturnType<typeof vi.fn>;

let mockReviewSingle: ReturnType<typeof vi.fn>;
let mockReviewSelect: ReturnType<typeof vi.fn>;
let mockReviewInsert: ReturnType<typeof vi.fn>;

let mockUpdateIn: ReturnType<typeof vi.fn>;
let mockUpdateEqUserId: ReturnType<typeof vi.fn>;
let mockItemsUpdate: ReturnType<typeof vi.fn>;

let mockChecksInsert: ReturnType<typeof vi.fn>;

let mockFrom: ReturnType<typeof vi.fn>;
let mockGenerateObject: ReturnType<typeof vi.fn>;

function buildMocks() {
  // Watchlist query chain:
  //   from("watchlists") → select("*") → eq("user_id", uid) →
  //     order("created_at", {asc:true}) → limit(1) → single()
  mockWatchlistSingle = vi.fn();
  mockWatchlistLimit = vi.fn(() => ({ single: mockWatchlistSingle }));
  mockWatchlistOrder = vi.fn(() => ({ limit: mockWatchlistLimit }));
  mockWatchlistEqUserId = vi.fn(() => ({ order: mockWatchlistOrder }));
  mockWatchlistSelect = vi.fn(() => ({ eq: mockWatchlistEqUserId }));

  // Items query chain:
  //   from("watchlist_items") → select("*") → eq("user_id", uid) →
  //     eq("watchlist_id", wid) → neq("status", "archived") →
  //       [optionally eq("id", itemId)] → order("updated_at", {asc:false})
  mockItemsOrder = vi.fn();
  mockItemsEqId = vi.fn(() => ({ order: mockItemsOrder }));
  mockItemsNeq = vi.fn(() => ({ order: mockItemsOrder, eq: mockItemsEqId }));
  mockItemsEqWatchlistId = vi.fn(() => ({ neq: mockItemsNeq }));
  mockItemsEqUserId = vi.fn(() => ({ eq: mockItemsEqWatchlistId }));
  mockItemsSelect = vi.fn(() => ({ eq: mockItemsEqUserId }));

  // Review insert chain:
  //   from("watchlist_reviews") → insert({...}) → select("id") → single()
  mockReviewSingle = vi.fn();
  mockReviewSelect = vi.fn(() => ({ single: mockReviewSingle }));
  mockReviewInsert = vi.fn(() => ({ select: mockReviewSelect }));

  // Update chain:
  //   from("watchlist_items") → update({...}) → eq("user_id", uid) →
  //     in("id", [...])
  mockUpdateIn = vi.fn();
  mockUpdateEqUserId = vi.fn(() => ({ in: mockUpdateIn }));
  mockItemsUpdate = vi.fn(() => ({ eq: mockUpdateEqUserId }));

  // Quality checks insert chain:
  //   from("watchlist_quality_checks") → insert([...])
  mockChecksInsert = vi.fn();

  // Routing: switch on table name
  mockFrom = vi.fn((tableName: string) => {
    switch (tableName) {
      case "watchlists":
        return { select: mockWatchlistSelect };
      case "watchlist_items":
        return { select: mockItemsSelect, update: mockItemsUpdate };
      case "watchlist_reviews":
        return { insert: mockReviewInsert };
      case "watchlist_quality_checks":
        return { insert: mockChecksInsert };
      default:
        return {};
    }
  });

  mockGenerateObject = vi.fn().mockResolvedValue(mockAiResult);
}

beforeEach(() => {
  buildMocks();
  vi.clearAllMocks();

  vi.mocked(createServerClient).mockResolvedValue({
    from: mockFrom,
  } as unknown);

  vi.mocked(buildWatchlistReviewPrompt).mockReturnValue({
    system: "You are an AI that assists with investment rule design.",
    user: JSON.stringify({
      watchlist: mockWatchlist,
      items: mockItems,
      scope: "watchlist",
    }),
  });

  vi.mocked(runSafetyCheck).mockReturnValue({
    passed: true,
    riskLevel: "low",
    violations: [],
    prohibitedPhrasesDetected: [],
  });

  vi.mocked(getAIProvider).mockReturnValue({
    generateObject: mockGenerateObject,
  } as unknown);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("runWatchlistReview", () => {
  // 1. Watchlist全体レビュー（itemIdなし）: watchlistが見つからない場合404
  describe("watchlist not found", () => {
    it("throws 404 AppError when no watchlist exists", async () => {
      mockWatchlistSingle.mockResolvedValue({
        data: null,
        error: { message: "No watchlist found" },
      });

      await expect(runWatchlistReview({ userId })).rejects.toThrow(AppError);
      await expect(runWatchlistReview({ userId })).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
        message: "Watchlistが見つかりません。",
      });

      expect(mockFrom).toHaveBeenCalledWith("watchlists");
    });
  });

  // 2. 個別itemレビュー: itemIdあり
  describe("single item review", () => {
    it("reviews a specific watchlist item when itemId is provided", async () => {
      const itemId = "item-1";
      mockWatchlistSingle.mockResolvedValue({
        data: mockWatchlist,
        error: null,
      });
      mockItemsOrder.mockResolvedValue({ data: [mockItems[0]], error: null });
      mockReviewSingle.mockResolvedValue({
        data: { id: "review-1" },
        error: null,
      });
      mockUpdateIn.mockResolvedValue({ error: null });
      mockChecksInsert.mockResolvedValue({ error: null });

      const result = await runWatchlistReview({ userId, itemId });

      // Verify the items query included the itemId filter
      expect(mockItemsEqId).toHaveBeenCalledWith("id", itemId);

      // Verify prompt included "item" scope
      expect(buildWatchlistReviewPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "item" }),
      );

      // Verify result
      expect(result.reviewId).toBe("review-1");
      expect(result.readinessScore).toBe(78);
    });
  });

  // 3. Safety passed: 正常にreview保存 + quality_checks保存
  describe("safety passed", () => {
    it("saves review and quality checks, returns full result", async () => {
      mockWatchlistSingle.mockResolvedValue({
        data: mockWatchlist,
        error: null,
      });
      mockItemsOrder.mockResolvedValue({ data: mockItems, error: null });
      mockReviewSingle.mockResolvedValue({
        data: { id: "review-success" },
        error: null,
      });
      mockUpdateIn.mockResolvedValue({ error: null });
      mockChecksInsert.mockResolvedValue({ error: null });

      const result = await runWatchlistReview({ userId });

      // ── Review insert assertions ──
      expect(mockReviewInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          watchlist_id: watchlistId,
          item_id: null,
          review_scope: "watchlist",
          safety_passed: true,
          summary: mockAiReview.summary,
          readiness_score: mockAiReview.readinessScore,
          error_message: null,
        }),
      );
      expect(mockReviewSelect).toHaveBeenCalledWith("id");
      expect(mockReviewSingle).toHaveBeenCalled();

      // ── Quality checks insert assertions ──
      expect(mockChecksInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: userId,
            watchlist_id: watchlistId,
            review_id: "review-success",
            check_key: "entry_exit_missing",
            status: "warning",
            severity: "medium",
          }),
        ]),
      );

      // ── Items update assertions ──
      expect(mockItemsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ last_reviewed_at: expect.any(String) }),
      );
      expect(mockUpdateEqUserId).toHaveBeenCalledWith("user_id", userId);
      expect(mockUpdateIn).toHaveBeenCalledWith(
        "id",
        expect.arrayContaining(["item-1", "item-2"]),
      );

      // ── Return value assertions ──
      expect(result).toEqual({
        reviewId: "review-success",
        summary: mockAiReview.summary,
        readinessScore: mockAiReview.readinessScore,
        needsMoreInfo: mockAiReview.needsMoreInfo,
        canCreateRuleSession: mockAiReview.canCreateRuleSession,
        qualityChecks: mockAiReview.qualityChecks,
        followUpQuestions: mockAiReview.followUpQuestions,
        suggestedRuleSessionTargets: mockAiReview.suggestedRuleSessionTargets,
      });
    });
  });

  // 4. Safety failed: SAFETY_FAILED error, review saved with safety_passed=false
  describe("safety failed", () => {
    it("saves review with safety_passed=false and throws SAFETY_FAILED", async () => {
      mockWatchlistSingle.mockResolvedValue({
        data: mockWatchlist,
        error: null,
      });
      mockItemsOrder.mockResolvedValue({ data: mockItems, error: null });
      mockReviewSingle.mockResolvedValue({
        data: { id: "review-failed" },
        error: null,
      });
      mockUpdateIn.mockResolvedValue({ error: null });
      // No quality checks insert should happen

      vi.mocked(runSafetyCheck).mockReturnValue({
        passed: false,
        riskLevel: "high",
        violations: [
          {
            type: "buy_recommendation",
            phrase: "買うべき",
            reason: "Contains buy recommendation",
          },
        ],
        prohibitedPhrasesDetected: ["買うべき"],
        suggestedRewrite: "Consider reviewing your criteria.",
      });

      await expect(runWatchlistReview({ userId })).rejects.toMatchObject({
        code: "SAFETY_FAILED",
        status: 422,
        message: "AI出力に安全性の問題があったため、表示できません。",
      });

      // Review is still saved with safety_passed=false
      expect(mockReviewInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          safety_passed: false,
          error_message: "SAFETY_FAILED",
          summary: null,
          readiness_score: null,
        }),
      );

      // Quality checks should NOT be inserted when safety fails
      expect(mockChecksInsert).not.toHaveBeenCalled();

      // Items SHOULD be updated (update happens before safety check)
      expect(mockItemsUpdate).toHaveBeenCalled();
    });
  });

  // 5. Items が空: VALIDATION_ERROR
  describe("items empty", () => {
    it("throws VALIDATION_ERROR when no watchlist items exist", async () => {
      mockWatchlistSingle.mockResolvedValue({
        data: mockWatchlist,
        error: null,
      });
      mockItemsOrder.mockResolvedValue({ data: [], error: null });

      await expect(runWatchlistReview({ userId })).rejects.toThrow(AppError);
      await expect(runWatchlistReview({ userId })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "レビュー対象のWatchlist itemがありません。",
      });

      // AI should not be called, no review inserted
      expect(mockGenerateObject).not.toHaveBeenCalled();
      expect(mockReviewInsert).not.toHaveBeenCalled();
    });
  });

  // ── Additional edge cases ──

  it("throws when watchlist item query fails with a database error", async () => {
    mockWatchlistSingle.mockResolvedValue({ data: mockWatchlist, error: null });
    mockItemsOrder.mockResolvedValue({
      data: null,
      error: new Error("DB error"),
    });

    await expect(runWatchlistReview({ userId })).rejects.toThrow();
    expect(mockReviewInsert).not.toHaveBeenCalled();
  });

  it("throws 500 when review insert fails", async () => {
    mockWatchlistSingle.mockResolvedValue({ data: mockWatchlist, error: null });
    mockItemsOrder.mockResolvedValue({ data: mockItems, error: null });
    mockReviewSingle.mockResolvedValue({
      data: null,
      error: { message: "Insert failed" },
    });

    await expect(runWatchlistReview({ userId })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Watchlistレビューの保存に失敗しました。",
    });
  });

  it("handles review without qualityChecks (empty array)", async () => {
    mockWatchlistSingle.mockResolvedValue({ data: mockWatchlist, error: null });
    mockItemsOrder.mockResolvedValue({ data: mockItems, error: null });

    // AI result with no quality checks
    const aiResultNoChecks = {
      ...mockAiResult,
      data: { ...mockAiReview, qualityChecks: [] },
    };
    mockGenerateObject.mockResolvedValue(aiResultNoChecks);

    mockReviewSingle.mockResolvedValue({
      data: { id: "review-nochecks" },
      error: null,
    });
    mockUpdateIn.mockResolvedValue({ error: null });

    const result = await runWatchlistReview({ userId });

    expect(mockChecksInsert).not.toHaveBeenCalled();
    expect(result.qualityChecks).toEqual([]);
  });

  it("includes item_id in saved review when itemId provided", async () => {
    mockWatchlistSingle.mockResolvedValue({ data: mockWatchlist, error: null });
    mockItemsOrder.mockResolvedValue({ data: [mockItems[0]], error: null });
    mockReviewSingle.mockResolvedValue({
      data: { id: "review-item" },
      error: null,
    });
    mockUpdateIn.mockResolvedValue({ error: null });
    mockChecksInsert.mockResolvedValue({ error: null });

    await runWatchlistReview({ userId, itemId: "item-1" });

    expect(mockReviewInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: "item-1",
        review_scope: "item",
      }),
    );
  });
});
