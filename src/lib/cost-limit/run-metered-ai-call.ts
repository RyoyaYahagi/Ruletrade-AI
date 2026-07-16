import "server-only";

import type { AiCallResult } from "@/lib/ai/provider-gateway";
import { AppError } from "@/lib/errors/app-error";
import { checkAiCostLimit } from "@/lib/cost-limit/check-ai-cost-limit";
import { incrementAiCostUsage } from "@/lib/cost-limit/increment-ai-cost-usage";

export async function runMeteredAiCall<T>(params: {
  userId: string;
  requestId?: string;
  feature: string;
  estimatedCostUsd: number;
  call: () => Promise<AiCallResult<T>>;
}) {
  await checkAiCostLimit({
    userId: params.userId,
    estimatedNextCostUsd: params.estimatedCostUsd,
  });

  const result = await params.call();
  if (!result.ok) {
    throw new AppError(
      "AI_PROVIDER_ERROR",
      "AIによるレビュー生成に失敗しました。",
      502,
      {
        feature: params.feature,
        requestId: params.requestId,
        error: result.error,
      },
      true,
    );
  }

  if ((result.estimatedCostUsd ?? 0) > 0) {
    await incrementAiCostUsage({
      userId: params.userId,
      costUsd: result.estimatedCostUsd!,
    });
  }

  return result;
}
