import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { getMonthlyCostPeriod } from "@/lib/cost-limit/cost-limit-period";

export async function incrementAiCostUsage(params: {
  userId: string;
  costUsd: number;
}): Promise<number> {
  const { periodStart, periodEnd } = getMonthlyCostPeriod();

  const db = await createDatabaseClient();

  const { data: existing, error: selectError } = await db
    .from("cost_limit_counters")
    .select("id, used_cost_usd, limit_cost_usd")
    .eq("user_id", params.userId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  const nextCostUsd = Number(existing?.used_cost_usd ?? 0) + params.costUsd;

  if (existing?.id) {
    const { error: updateError } = await db
      .from("cost_limit_counters")
      .update({ used_cost_usd: nextCostUsd })
      .eq("id", existing.id)
      .eq("user_id", params.userId);

    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await db.from("cost_limit_counters").insert({
      user_id: params.userId,
      period_start: periodStart,
      period_end: periodEnd,
      used_cost_usd: nextCostUsd,
    });

    if (insertError) throw insertError;
  }

  return nextCostUsd;
}
