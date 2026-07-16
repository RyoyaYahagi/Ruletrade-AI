export const DEFAULT_MONTHLY_AI_COST_LIMIT_USD = 1;
export const ESTIMATED_AI_RULE_REVIEW_COST_USD = 0.05;

export type MeteredFeature =
  | "rule_review"
  | "watchlist_review"
  | "thesis_draft"
  | "news_classify"
  | "news_summarize"
  | "portfolio_review"
  | "holistic_review";

export const ESTIMATED_AI_COST_USD: Record<MeteredFeature, number> = {
  rule_review: ESTIMATED_AI_RULE_REVIEW_COST_USD,
  watchlist_review: 0.05,
  thesis_draft: 0.02,
  news_classify: 0.002,
  news_summarize: 0.02,
  portfolio_review: 0.05,
  holistic_review: 0.1,
};

export type CostLimitResult = {
  allowed: boolean;
  usedCostUsd: number;
  limitCostUsd: number;
  remainingCostUsd: number;
  periodStart: string;
  periodEnd: string;
};
