import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";

export async function getUserAiBudgetSetting(userId: string) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("user_ai_budget_settings")
    .select("id, user_id, monthly_limit_usd, warning_notified_period")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "AI利用上限設定の取得に失敗しました。",
      500,
      error,
    );
  }

  return data;
}

export async function saveUserAiBudgetSetting(params: {
  userId: string;
  monthlyLimitUsd: number;
}) {
  const db = await createDatabaseClient();
  const existing = await getUserAiBudgetSetting(params.userId);

  const result = existing?.id
    ? await db
        .from("user_ai_budget_settings")
        .update({ monthly_limit_usd: params.monthlyLimitUsd })
        .eq("id", existing.id)
        .eq("user_id", params.userId)
        .select("*")
        .single()
    : await db
        .from("user_ai_budget_settings")
        .insert({
          user_id: params.userId,
          monthly_limit_usd: params.monthlyLimitUsd,
          warning_notified_period: null,
        })
        .select("*")
        .single();

  if (result.error || !result.data) {
    throw new AppError(
      "DATABASE_ERROR",
      "AI利用上限設定の保存に失敗しました。",
      500,
      result.error,
    );
  }

  return result.data;
}

export async function markAiBudgetWarningPeriod(params: {
  userId: string;
  period: string;
}) {
  const db = await createDatabaseClient();
  const existing = await getUserAiBudgetSetting(params.userId);

  const result = existing?.id
    ? await db
        .from("user_ai_budget_settings")
        .update({ warning_notified_period: params.period })
        .eq("id", existing.id)
        .eq("user_id", params.userId)
    : await db.from("user_ai_budget_settings").insert({
        user_id: params.userId,
        monthly_limit_usd: null,
        warning_notified_period: params.period,
      });

  if (result.error) {
    throw new AppError(
      "DATABASE_ERROR",
      "AI利用上限警告状態の保存に失敗しました。",
      500,
      result.error,
    );
  }
}
