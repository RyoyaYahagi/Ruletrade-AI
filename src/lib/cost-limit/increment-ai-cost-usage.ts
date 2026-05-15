import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { getMonthlyCostPeriod } from "@/lib/cost-limit/cost-limit-period";

export async function incrementAiCostUsage(params: {
  userId: string;
  costUsd: number;
}) {
  const { periodStart, periodEnd } = getMonthlyCostPeriod();

  const supabase = await createClient();

  const { error } = await supabase.rpc("increment_cost_limit_counter", {
    p_user_id: params.userId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_cost_usd: params.costUsd,
  });

  if (error) {
    throw error;
  }
}
