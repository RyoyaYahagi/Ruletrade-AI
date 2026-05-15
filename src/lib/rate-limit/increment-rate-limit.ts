import "server-only";

import { createClient } from "@/lib/db/supabase-server";
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

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("increment_rate_limit_counter", {
    p_user_id: params.userId,
    p_limit_key: params.key,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_increment_by: incrementBy,
  });

  if (error) {
    throw error;
  }

  return data ?? incrementBy;
}
