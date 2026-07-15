import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import {
  RATE_LIMIT_CONFIGS,
  type RateLimitKey,
} from "@/lib/rate-limit/rate-limit-types";
import { getRateLimitPeriod } from "@/lib/rate-limit/rate-limit-period";

export async function checkRateLimit(params: {
  userId: string;
  key: RateLimitKey;
}) {
  const config = RATE_LIMIT_CONFIGS[params.key];
  const { periodStart, periodEnd } = getRateLimitPeriod(config.window);

  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("rate_limit_counters")
    .select("used_count")
    .eq("user_id", params.userId)
    .eq("limit_key", params.key)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "レート制限の確認に失敗しました。",
      500,
      { originalError: error.message },
      false,
    );
  }

  const usedCount = data?.used_count ?? 0;

  if (usedCount >= config.limit) {
    throw new AppError(
      "RATE_LIMITED",
      "利用回数の上限に達しました。",
      429,
      {
        key: params.key,
        limit: config.limit,
        usedCount,
        periodStart,
        periodEnd,
      },
      true,
    );
  }

  return {
    allowed: true,
    limit: config.limit,
    usedCount,
    remaining: config.limit - usedCount,
    periodStart,
    periodEnd,
  };
}
