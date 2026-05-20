import { describe, expect, test } from "vitest";
import { AI_TIMEOUTS } from "@/lib/performance/ai-timeouts";

describe("AI_TIMEOUTS", () => {
  test("all timeouts are positive", () => {
    expect(AI_TIMEOUTS.ruleReviewMs).toBeGreaterThan(0);
    expect(AI_TIMEOUTS.watchlistReviewMs).toBeGreaterThan(0);
    expect(AI_TIMEOUTS.portfolioReviewMs).toBeGreaterThan(0);
    expect(AI_TIMEOUTS.documentSummaryMs).toBeGreaterThan(0);
    expect(AI_TIMEOUTS.embeddingMs).toBeGreaterThan(0);
  });
});
