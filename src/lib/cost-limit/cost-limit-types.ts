import type { MeteredFeature } from "@/lib/cost-limit/run-metered-ai-call";

export const DEFAULT_MONTHLY_AI_COST_LIMIT_USD = 1;
export const MAX_USER_MONTHLY_LIMIT_USD = 10;

export const ESTIMATED_AI_COST_USD: Record<MeteredFeature, number> = {
  rule_review: 0.05,
  watchlist_review: 0.05,
  thesis_draft: 0.02,
  news_classify: 0.002,
  news_summarize: 0.02,
  portfolio_review: 0.05,
  holistic_review: 0.1,
  portfolio_rule_guidance: 0.02,
  portfolio_import: 0.05,
  document_summary: 0.02,
};

export const ESTIMATED_AI_RULE_REVIEW_COST_USD =
  ESTIMATED_AI_COST_USD.rule_review;

export type CostLimitResult = {
  allowed: boolean;
  usedCostUsd: number;
  limitCostUsd: number;
  remainingCostUsd: number;
  periodStart: string;
  periodEnd: string;
};
