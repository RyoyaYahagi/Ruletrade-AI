import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { getMonthlyCostPeriod } from "@/lib/cost-limit/cost-limit-period";
import { DEFAULT_MONTHLY_AI_COST_LIMIT_USD } from "@/lib/cost-limit/cost-limit-types";

export async function checkAiCostLimit(params: {
  userId: string;
  estimatedNextCostUsd?: number;
}) {
  const { periodStart, periodEnd } = getMonthlyCostPeriod();
  const estimatedNextCostUsd = params.estimatedNextCostUsd ?? 0;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cost_limit_counters")
    .select("used_cost_usd, limit_cost_usd")
    .eq("user_id", params.userId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
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

  const usedCostUsd = Number(data?.used_cost_usd ?? 0);
  const limitCostUsd = Number(
    data?.limit_cost_usd ?? DEFAULT_MONTHLY_AI_COST_LIMIT_USD,
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
