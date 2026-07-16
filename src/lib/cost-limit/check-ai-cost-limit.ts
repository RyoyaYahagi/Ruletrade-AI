import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { getMonthlyCostPeriod } from "@/lib/cost-limit/cost-limit-period";
import { DEFAULT_MONTHLY_AI_COST_LIMIT_USD } from "@/lib/cost-limit/cost-limit-types";

export async function checkAiCostLimit(params: {
  userId: string;
  estimatedNextCostUsd?: number;
}) {
  const { periodStart, periodEnd } = getMonthlyCostPeriod();
  const estimatedNextCostUsd = params.estimatedNextCostUsd ?? 0;

  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("cost_limit_counters")
    .select("used_cost_usd, limit_cost_usd")
    .eq("user_id", params.userId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  const { data: budgetSetting, error: budgetSettingError } = await db
    .from("user_ai_budget_settings")
    .select("monthly_limit_usd")
    .eq("user_id", params.userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "コスト制限の確認に失敗しました。",
      500,
      { originalError: error.message },
      false,
    );
  }

  if (budgetSettingError) {
    throw new AppError(
      "DATABASE_ERROR",
      "AI利用上限設定の確認に失敗しました。",
      500,
      { originalError: budgetSettingError.message },
      false,
    );
  }

  const usedCostUsd = Number(data?.used_cost_usd ?? 0);
  const limitCostUsd = Number(
    budgetSetting?.monthly_limit_usd ??
      data?.limit_cost_usd ??
      DEFAULT_MONTHLY_AI_COST_LIMIT_USD,
  );

  if (usedCostUsd + estimatedNextCostUsd > limitCostUsd) {
    throw new AppError(
      "COST_LIMIT_EXCEEDED",
      "今月のAI利用上限に達しました。",
      402,
      {
        usedCostUsd,
        limitCostUsd,
        estimatedNextCostUsd,
        periodStart,
        periodEnd,
      },
      false,
    );
  }

  return {
    allowed: true,
    usedCostUsd,
    limitCostUsd,
    remainingCostUsd: limitCostUsd - usedCostUsd,
    periodStart,
    periodEnd,
  };
}
