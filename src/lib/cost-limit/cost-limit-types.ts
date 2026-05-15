export const DEFAULT_MONTHLY_AI_COST_LIMIT_USD = 1;

export type CostLimitResult = {
  allowed: boolean;
  usedCostUsd: number;
  limitCostUsd: number;
  remainingCostUsd: number;
  periodStart: string;
  periodEnd: string;
};
