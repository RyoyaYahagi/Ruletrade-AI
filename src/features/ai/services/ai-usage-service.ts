import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import {
  DEFAULT_MONTHLY_AI_COST_LIMIT_USD,
  MAX_USER_MONTHLY_LIMIT_USD,
} from "@/lib/cost-limit/cost-limit-types";
import { getMonthlyCostPeriod } from "@/lib/cost-limit/cost-limit-period";
import {
  getUserAiBudgetSetting,
  saveUserAiBudgetSetting,
} from "@/lib/cost-limit/budget-settings-service";

export async function getAiUsageSummary(userId: string) {
  const { periodStart, periodEnd } = getMonthlyCostPeriod();
  const db = await createDatabaseClient();
  const [counterResult, logsResult, setting] = await Promise.all([
    db
      .from("cost_limit_counters")
      .select("used_cost_usd, limit_cost_usd")
      .eq("user_id", userId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle(),
    db
      .from("ai_run_logs")
      .select("task_type, estimated_cost_usd")
      .eq("user_id", userId)
      .gte("started_at", periodStart)
      .lt("started_at", periodEnd),
    getUserAiBudgetSetting(userId),
  ]);

  if (counterResult.error) {
    throw new AppError(
      "DATABASE_ERROR",
      "AI利用額の取得に失敗しました。",
      500,
      counterResult.error,
    );
  }
  if (logsResult.error) {
    throw new AppError(
      "DATABASE_ERROR",
      "AI利用明細の取得に失敗しました。",
      500,
      logsResult.error,
    );
  }

  const usedCostUsd = Number(counterResult.data?.used_cost_usd ?? 0);
  const limitCostUsd = Number(
    setting?.monthly_limit_usd ??
      counterResult.data?.limit_cost_usd ??
      DEFAULT_MONTHLY_AI_COST_LIMIT_USD,
  );
  const featureMap = new Map<string, { callCount: number; costUsd: number }>();

  for (const row of logsResult.data ?? []) {
    const taskType = String(row.task_type ?? "unknown");
    const current = featureMap.get(taskType) ?? { callCount: 0, costUsd: 0 };
    current.callCount += 1;
    current.costUsd += Number(row.estimated_cost_usd ?? 0);
    featureMap.set(taskType, current);
  }

  return {
    period: { start: periodStart, end: periodEnd },
    usedCostUsd,
    limitCostUsd,
    remainingCostUsd: Math.max(0, limitCostUsd - usedCostUsd),
    byFeature: Array.from(featureMap.entries())
      .map(([taskType, value]) => ({
        taskType,
        callCount: value.callCount,
        costUsd: Number(value.costUsd.toFixed(6)),
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
  };
}

export async function getAiUsageSettings(userId: string) {
  const setting = await getUserAiBudgetSetting(userId);
  return {
    monthlyLimitUsd: Number(
      setting?.monthly_limit_usd ?? DEFAULT_MONTHLY_AI_COST_LIMIT_USD,
    ),
    maxMonthlyLimitUsd: MAX_USER_MONTHLY_LIMIT_USD,
  };
}

export async function updateAiUsageSettings(params: {
  userId: string;
  monthlyLimitUsd: number;
}) {
  const setting = await saveUserAiBudgetSetting(params);
  return {
    monthlyLimitUsd: Number(setting.monthly_limit_usd),
    maxMonthlyLimitUsd: MAX_USER_MONTHLY_LIMIT_USD,
  };
}

export async function getAdminAiUsage() {
  const { periodStart, periodEnd } = getMonthlyCostPeriod();
  const db = await createDatabaseClient();
  const [counterResult, logsResult] = await Promise.all([
    db
      .from("cost_limit_counters")
      .select("user_id, used_cost_usd")
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd),
    db
      .from("ai_run_logs")
      .select("user_id, task_type, estimated_cost_usd")
      .gte("started_at", periodStart)
      .lt("started_at", periodEnd),
  ]);

  if (counterResult.error || logsResult.error) {
    throw new AppError(
      "DATABASE_ERROR",
      "管理者向けAI利用額の取得に失敗しました。",
      500,
      counterResult.error ?? logsResult.error,
    );
  }

  const userMap = new Map<string, number>();
  const counterUserIds = new Set<string>();
  for (const row of counterResult.data ?? []) {
    const userId = String(row.user_id);
    counterUserIds.add(userId);
    userMap.set(userId, Number(row.used_cost_usd ?? 0));
  }

  const featureMap = new Map<string, number>();
  for (const row of logsResult.data ?? []) {
    const userId = String(row.user_id);
    const cost = Number(row.estimated_cost_usd ?? 0);
    // Counters are authoritative for users that have one. Logs remain the
    // source for users created before the counter row was initialized.
    if (!counterUserIds.has(userId)) {
      userMap.set(userId, (userMap.get(userId) ?? 0) + cost);
    }
    const taskType = String(row.task_type ?? "unknown");
    featureMap.set(taskType, (featureMap.get(taskType) ?? 0) + cost);
  }

  const topUsers = Array.from(userMap.entries())
    .map(([userId, costUsd]) => ({
      userId,
      costUsd: Number(costUsd.toFixed(6)),
    }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 20);

  return {
    period: { start: periodStart, end: periodEnd },
    totalCostUsd: Number(
      Array.from(userMap.values())
        .reduce((sum, cost) => sum + cost, 0)
        .toFixed(6),
    ),
    topUsers,
    byFeature: Array.from(featureMap.entries())
      .map(([taskType, costUsd]) => ({
        taskType,
        costUsd: Number(costUsd.toFixed(6)),
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
  };
}
