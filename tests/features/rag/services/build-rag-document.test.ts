import { describe, expect, it } from "vitest";
import {
  buildRuleSessionRagContent,
  buildWatchlistItemRagContent,
  buildPortfolioPositionRagContent,
} from "@/features/rag/services/build-rag-document";

describe("buildRuleSessionRagContent", () => {
  it("rule_jsonの内容を含むテキストを作る", () => {
    const content = buildRuleSessionRagContent({
      ticker: "AAPL",
      company_name: "Apple Inc.",
      rule_json: {
        investmentThesis: "グロース株",
        timeHorizon: "1年",
      },
      completion_score: 80,
      status: "draft",
    });

    expect(content).toContain("銘柄: AAPL");
    expect(content).toContain("銘柄名: Apple Inc.");
    expect(content).toContain("投資理由: グロース株");
    expect(content).toContain("投資期間: 1年");
    expect(content).toContain("完成度スコア: 80");
  });

  it("nullフィールドは除外する", () => {
    const content = buildRuleSessionRagContent({
      ticker: "TSLA",
    });

    expect(content).toContain("銘柄: TSLA");
    expect(content).not.toContain("銘柄名:");
  });
});

describe("buildWatchlistItemRagContent", () => {
  it("watchlistアイテムの内容を含むテキストを作る", () => {
    const content = buildWatchlistItemRagContent({
      ticker: "AAPL",
      company_name: "Apple",
      interest_reason: "好業績",
      target_price_min: 100,
      target_price_max: 150,
    });

    expect(content).toContain("銘柄: AAPL");
    expect(content).toContain("気になる理由: 好業績");
    expect(content).toContain("買いたい価格帯: 100 〜 150");
  });
});

describe("buildPortfolioPositionRagContent", () => {
  it("portfolioポジションの内容を含むテキストを作る", () => {
    const content = buildPortfolioPositionRagContent({
      ticker: "AAPL",
      company_name: "Apple",
      sector: "Technology",
      market_value: 100000,
    });

    expect(content).toContain("銘柄: AAPL");
    expect(content).toContain("セクター: Technology");
    expect(content).toContain("時価総額: 100000");
  });
});
