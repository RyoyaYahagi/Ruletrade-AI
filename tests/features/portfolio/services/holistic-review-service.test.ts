import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  buildHolisticReviewFacts,
  listHolisticReviews,
  sanitizeRelatedSymbols,
} from "@/features/portfolio/services/holistic-review-service";
import { createDatabaseClient } from "@/lib/db/database-client";

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

describe("buildHolisticReviewFacts", () => {
  it("保有比率、承認済みルール、出口条件、期限超過を決定的に集計する", () => {
    const now = new Date("2026-07-16T00:00:00.000Z");
    const facts = buildHolisticReviewFacts({
      cashAmount: 200,
      positions: [
        {
          ticker: "AAA",
          company_name: "A社",
          market_value: 800,
          rule_session_id: "session-approved",
        },
        {
          ticker: "BBB",
          company_name: "B社",
          market_value: 500,
          rule_session_id: "session-no-exit",
        },
        {
          ticker: "CCC",
          company_name: "C社",
          market_value: 300,
          rule_session_id: null,
        },
      ],
      sessions: [
        {
          id: "session-approved",
          ticker: "AAA",
          status: "finalized",
          rule_json: { exitPlan: { exitConditions: ["見直す"] } },
          last_reviewed_at: "2026-06-01T00:00:00.000Z",
        },
        {
          id: "session-no-exit",
          ticker: "BBB",
          quality_gate_status: "passed",
          rule_json: {},
          last_reviewed_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      investmentMemory: { risk_tolerance: "moderate" },
      now,
    });

    expect(facts.portfolio.totalValue).toBe(1800);
    expect(facts.positions[0]).toMatchObject({
      ticker: "AAA",
      weightPercent: 44.44,
      hasApprovedRule: true,
      hasExitCondition: true,
    });
    expect(facts.positionsWithoutApprovedRule).toEqual(["CCC"]);
    expect(facts.positionsWithoutExitCondition).toEqual(["BBB"]);
    expect(facts.staleRules).toEqual([
      {
        sessionId: "session-no-exit",
        ticker: "BBB",
        lastReviewedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("sanitizeRelatedSymbols", () => {
  it("実在しない保有銘柄を関連銘柄から除外する", () => {
    const review = {
      overallNote: "確認しました。",
      findings: [
        {
          category: "missing_rule" as const,
          status: "attention" as const,
          message: "ルールを確認してください。",
          relatedSymbols: ["AAA", "NOT-HELD"],
        },
      ],
    };

    expect(sanitizeRelatedSymbols(review, ["AAA"])).toEqual({
      ...review,
      findings: [{ ...review.findings[0], relatedSymbols: ["AAA"] }],
    });
  });
});

describe("listHolisticReviews", () => {
  const mockOrder = vi.fn();
  const mockEqUser = vi.fn(() => ({ order: mockOrder }));
  const mockSelect = vi.fn(() => ({ eq: mockEqUser }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createDatabaseClient).mockResolvedValue({
      from: mockFrom,
    } as never);
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  it("ユーザーIDで絞り込み、他ユーザーのレビューを取得しない", async () => {
    const result = await listHolisticReviews({ userId: "user-a" });

    expect(result.reviews).toEqual([]);
    expect(mockFrom).toHaveBeenCalledWith("holistic_reviews");
    expect(mockEqUser).toHaveBeenCalledWith("user_id", "user-a");
  });
});
