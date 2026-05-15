import type { AIUsage } from "@/lib/ai/provider";

// TODO: コスト見積りロジックの未実装 — 各プロバイダー/モデルのトークン単価を参照して見積りコストを計算する
export function withUnestimatedCost(usage: AIUsage): AIUsage {
  return {
    ...usage,
    estimatedCostUsd: usage.estimatedCostUsd,
  };
}
