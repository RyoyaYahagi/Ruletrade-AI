import "server-only";

import { checkAiCostLimit } from "@/lib/cost-limit/check-ai-cost-limit";
import { incrementAiCostUsage } from "@/lib/cost-limit/increment-ai-cost-usage";
import {
  ESTIMATED_AI_COST_USD,
  type MeteredFeature,
} from "@/lib/cost-limit/cost-limit-types";

export async function runMeteredAiCall<T>(params: {
  userId: string;
  feature: MeteredFeature;
  estimatedCostUsd?: number;
  execute: () => Promise<{ result: T; actualCostUsd?: number } | T>;
}): Promise<T> {
  const estimatedCostUsd = params.estimatedCostUsd ?? ESTIMATED_AI_COST_USD[params.feature];
  await checkAiCostLimit({
    userId: params.userId,
    estimatedNextCostUsd: estimatedCostUsd,
  });

  const execution = await params.execute();
  const metered =
    typeof execution === "object" && execution !== null && "result" in execution
      ? execution
      : { result: execution, actualCostUsd: undefined };
  const actualCostUsd =
    "actualCostUsd" in metered && typeof metered.actualCostUsd === "number"
      ? metered.actualCostUsd
      : estimatedCostUsd;

  // When provider usage is unavailable, over-counting is safer than allowing an unbounded AI cost.
  await incrementAiCostUsage({ userId: params.userId, costUsd: actualCostUsd });
  return metered.result as T;
}
