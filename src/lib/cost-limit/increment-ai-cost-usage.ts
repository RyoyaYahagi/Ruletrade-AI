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
    if (isUnsupportedLocalRpc(error)) {
      const { data: existing, error: selectError } = await supabase
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
        const { error: updateError } = await supabase
          .from("cost_limit_counters")
          .update({ used_cost_usd: nextCostUsd })
          .eq("id", existing.id)
          .eq("user_id", params.userId);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from("cost_limit_counters")
          .insert({
            user_id: params.userId,
            period_start: periodStart,
            period_end: periodEnd,
            used_cost_usd: nextCostUsd,
          });

        if (insertError) {
          throw insertError;
        }
      }

      return nextCostUsd;
    }

    throw error;
  }

  return Number(data ?? params.costUsd);
}

function isUnsupportedLocalRpc(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "SQLITE_UNSUPPORTED"
  );
}
