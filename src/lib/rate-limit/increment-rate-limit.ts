import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import {
  RATE_LIMIT_CONFIGS,
  type RateLimitKey,
} from "@/lib/rate-limit/rate-limit-types";
import { getRateLimitPeriod } from "@/lib/rate-limit/rate-limit-period";

export async function incrementRateLimit(params: {
  userId: string;
  key: RateLimitKey;
  incrementBy?: number;
}): Promise<number> {
  const config = RATE_LIMIT_CONFIGS[params.key];
  const { periodStart, periodEnd } = getRateLimitPeriod(config.window);
  const incrementBy = params.incrementBy ?? 1;

  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc("increment_rate_limit_counter", {
    p_user_id: params.userId,
    p_limit_key: params.key,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_increment_by: incrementBy,
  });

  if (error) {
    if (isUnsupportedLocalRpc(error)) {
      const { data: existing, error: selectError } = await supabase
        .from("rate_limit_counters")
        .select("id, used_count")
        .eq("user_id", params.userId)
        .eq("limit_key", params.key)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .maybeSingle();

      if (selectError) {
        throw selectError;
      }

      const nextCount = Number(existing?.used_count ?? 0) + incrementBy;

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("rate_limit_counters")
          .update({ used_count: nextCount })
          .eq("id", existing.id)
          .eq("user_id", params.userId);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from("rate_limit_counters")
          .insert({
            user_id: params.userId,
            limit_key: params.key,
            period_start: periodStart,
            period_end: periodEnd,
            used_count: nextCount,
          });

        if (insertError) {
          throw insertError;
        }
      }

      return nextCount;
    }

    throw error;
  }

  return data ?? incrementBy;
}

function isUnsupportedLocalRpc(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "SQLITE_UNSUPPORTED"
  );
}
