import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { getMonthlyCostPeriod } from "@/lib/cost-limit/cost-limit-period";
import { DEFAULT_MONTHLY_AI_COST_LIMIT_USD } from "@/lib/cost-limit/cost-limit-types";

export async function incrementAiCostUsage(params: {
  userId: string;
  costUsd: number;
}) {
  const { periodStart, periodEnd } = getMonthlyCostPeriod();

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("cost_limit_counters")
    .select("id, used_cost_usd, limit_cost_usd")
    .eq("user_id", params.userId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    const { error } = await supabase.from("cost_limit_counters").insert({
      user_id: params.userId,
      period_start: periodStart,
      period_end: periodEnd,
      used_cost_usd: params.costUsd,
      limit_cost_usd: DEFAULT_MONTHLY_AI_COST_LIMIT_USD,
    });

    if (error) {
      throw error;
    }

    return;
  }

  const nextUsedCost = Number(existing.used_cost_usd ?? 0) + params.costUsd;

  const { error } = await supabase
    .from("cost_limit_counters")
    .update({
      used_cost_usd: nextUsedCost,
    })
    .eq("id", existing.id)
    .eq("user_id", params.userId);

  if (error) {
    throw error;
  }
}
