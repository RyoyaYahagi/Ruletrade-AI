import "server-only";

import { createNotification } from "@/features/notifications/services/notification-service";
import {
  getUserAiBudgetSetting,
  markAiBudgetWarningPeriod,
} from "@/lib/cost-limit/budget-settings-service";
import { checkAiCostLimit } from "@/lib/cost-limit/check-ai-cost-limit";
import { incrementAiCostUsage } from "@/lib/cost-limit/increment-ai-cost-usage";

export type MeteredFeature =
  | "rule_review"
  | "watchlist_review"
  | "thesis_draft"
  | "news_classify"
  | "news_summarize"
  | "portfolio_review"
  | "holistic_review"
  | "portfolio_rule_guidance"
  | "portfolio_import"
  | "document_summary";

export async function runMeteredAiCall<T>(params: {
  userId: string;
  feature: MeteredFeature;
  estimatedCostUsd: number;
  execute: () => Promise<{
    result: T;
    actualCostUsd: number | undefined;
  }>;
}): Promise<T> {
  const estimatedCostUsd = params.estimatedCostUsd;
  const limitStatus = await checkAiCostLimit({
    userId: params.userId,
    estimatedNextCostUsd: estimatedCostUsd,
  });
  const executed = await params.execute();
  // 実測値がないプロバイダでは過小計上を避けるため、事前見積りを加算する。
  const costUsd = executed.actualCostUsd ?? estimatedCostUsd;
  const usedCostUsd = await incrementAiCostUsage({
    userId: params.userId,
    costUsd,
  });

  if (
    limitStatus.limitCostUsd > 0 &&
    usedCostUsd / limitStatus.limitCostUsd >= 0.8
  ) {
    await createAiBudgetWarningIfNeeded({
      userId: params.userId,
      usedCostUsd,
      limitCostUsd: limitStatus.limitCostUsd,
    });
  }

  return executed.result;
}

async function createAiBudgetWarningIfNeeded(params: {
  userId: string;
  usedCostUsd: number;
  limitCostUsd: number;
}) {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const setting = await getUserAiBudgetSetting(params.userId);

  if (setting?.warning_notified_period === period) return;

  await createNotification({
    userId: params.userId,
    notificationType: "ai_budget_warning",
    title: "AI利用上限に近づいています",
    body: `今月のAI利用額が上限の80%に達しました（$${params.usedCostUsd.toFixed(2)} / $${params.limitCostUsd.toFixed(2)}）。上限は設定画面で変更できます。`,
    severity: "warning",
    targetType: "system",
    actionUrl: "/settings/ai-usage",
    metadata: {
      period,
      usedCostUsd: params.usedCostUsd,
      limitCostUsd: params.limitCostUsd,
    },
  });

  await markAiBudgetWarningPeriod({
    userId: params.userId,
    period,
  });
}
