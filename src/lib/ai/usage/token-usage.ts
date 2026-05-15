import type { AIUsage } from "@/lib/ai/provider";

export const zeroAIUsage: AIUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
};

export function normalizeAIUsage(usage: AIUsage): AIUsage {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
  };
}
