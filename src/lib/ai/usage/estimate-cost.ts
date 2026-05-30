import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function estimateAiCostUsd(params: {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  const inputTokens = params.inputTokens ?? 0;
  const outputTokens = params.outputTokens ?? 0;

  if (inputTokens === 0 && outputTokens === 0) {
    return 0;
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("model_pricing_configs")
    .select("input_cost_per_1m_tokens_usd, output_cost_per_1m_tokens_usd")
    .eq("provider", params.provider)
    .eq("model", params.model)
    .eq("is_active", true)
    .order("effective_from", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  const inputCost =
    (inputTokens / 1_000_000) * Number(data.input_cost_per_1m_tokens_usd);

  const outputCost =
    (outputTokens / 1_000_000) * Number(data.output_cost_per_1m_tokens_usd);

  return Number((inputCost + outputCost).toFixed(6));
}
