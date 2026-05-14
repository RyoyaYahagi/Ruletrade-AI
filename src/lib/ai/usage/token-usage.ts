import type { AIUsage } from "@/lib/ai/provider";

export const zeroAIUsage: AIUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
};

export function normalizeAIUsage(usage: AIUsage): AIUsage {
  const inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;
  const totalTokens = usage.totalTokens ?? sumTokens(inputTokens, outputTokens);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
  };
}

function sumTokens(
  inputTokens?: number,
  outputTokens?: number
): number | undefined {
  if (inputTokens === undefined && outputTokens === undefined) {
    return undefined;
  }

  return (inputTokens ?? 0) + (outputTokens ?? 0);
}
