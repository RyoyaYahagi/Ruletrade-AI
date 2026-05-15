export const DEFAULT_MONTHLY_AI_COST_LIMIT_USD = 1;
export const ESTIMATED_AI_RULE_REVIEW_COST_USD = 0.05;

export type CostLimitResult = {
  allowed: boolean;
  usedCostUsd: number;
  limitCostUsd: number;
  remainingCostUsd: number;
  periodStart: string;
  periodEnd: string;
};
