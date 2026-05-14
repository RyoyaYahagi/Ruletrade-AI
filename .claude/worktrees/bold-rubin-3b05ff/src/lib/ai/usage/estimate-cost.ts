import type { AIUsage } from "@/lib/ai/provider";

export function withUnestimatedCost(usage: AIUsage): AIUsage {
  return {
    ...usage,
    estimatedCostUsd: usage.estimatedCostUsd,
  };
}
