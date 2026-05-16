import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { getMonthlyCostPeriod } from "@/lib/cost-limit/cost-limit-period";

export async function incrementAiCostUsage(params: {
  userId: string;
  costUsd: number;
}): Promise<number> {
  const { periodStart, periodEnd } = getMonthlyCostPeriod();

  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc("increment_cost_limit_counter", {
    p_user_id: params.userId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_cost_usd: params.costUsd,
  });

  if (error) {
    throw error;
  }

  return Number(data ?? params.costUsd);
}
