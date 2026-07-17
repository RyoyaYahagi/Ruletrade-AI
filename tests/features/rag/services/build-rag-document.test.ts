import { describe, expect, it } from "vitest";
import {
  buildRuleSessionRagContent,
  buildWatchlistItemRagContent,
  buildPortfolioPositionRagContent,
  buildAlertResolutionRagContent,
  buildNewsAssessmentRagContent,
  buildHolisticReviewRagContent,
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

describe("judgement RAG documents", () => {
  it("records alert resolutions without turning them into advice", () => {
    const content = buildAlertResolutionRagContent({
      quoteDate: "2026-07-17",
      ticker: "7203",
      conditionKey: "stop_loss_review",
      resolution: "revising",
    });
    expect(content).toContain("7203");
    expect(content).toContain("ルールを見直す");
    expect(content).toContain("過去の判断記録");
  });

  it("limits a thesis excerpt to the defined context boundary", () => {
    const content = buildNewsAssessmentRagContent({
      publishedAt: "2026-07-17",
      ticker: "7203",
      title: "ニュース",
      thesis: "a".repeat(300),
      thesisRelation: "supports",
      summary: "要約",
    });
    expect(content).toContain(`仮説「${"a".repeat(100)}」`);
    expect(content).not.toContain(`仮説「${"a".repeat(101)}`);
  });

  it("keeps holistic findings as user-owned review context", () => {
    const content = buildHolisticReviewRagContent({
      period: "2026-07",
      summaryText: "登録情報を確認しました。",
      findings: [{ category: "missing_exit", status: "attention", message: "出口条件を確認してください。", relatedSymbols: ["7203"] }],
    });
    expect(content).toContain("月次レビュー 2026-07");
    expect(content).toContain("出口条件を確認してください。");
    expect(content).toContain("関連銘柄: 7203");
  });
});
