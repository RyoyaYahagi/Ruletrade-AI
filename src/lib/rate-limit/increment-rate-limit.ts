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
}) {
  const config = RATE_LIMIT_CONFIGS[params.key];
  const { periodStart, periodEnd } = getRateLimitPeriod(config.window);
  const incrementBy = params.incrementBy ?? 1;

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("rate_limit_counters")
    .select("id, used_count")
    .eq("user_id", params.userId)
    .eq("limit_key", params.key)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    const { error } = await supabase.from("rate_limit_counters").insert({
      user_id: params.userId,
      limit_key: params.key,
      period_start: periodStart,
      period_end: periodEnd,
      used_count: incrementBy,
    });

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("rate_limit_counters")
    .update({
      used_count: existing.used_count + incrementBy,
    })
    .eq("id", existing.id)
    .eq("user_id", params.userId);

  if (error) {
    throw error;
  }
}
