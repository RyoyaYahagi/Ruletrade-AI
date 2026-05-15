import "server-only";

import { saveAiRunLog } from "@/lib/ai/logs/save-ai-run-log";
import { updateAiRunLog } from "@/lib/ai/logs/update-ai-run-log";
import { logAiRunEvent } from "@/lib/ai/logs/log-ai-run-event";
import { estimateAiCostUsd } from "@/lib/ai/usage/estimate-cost";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import type { AiTaskType } from "@/lib/ai/logs/ai-run-log-types";
import type { AiRunSourceType } from "@/lib/ai/logs/ai-run-log-types";

export async function withAiRunLogging<T>(params: {
  userId: string;
  requestId?: string;
  taskType: AiTaskType;
  sourceType?: AiRunSourceType;
  sourceId?: string;
  sessionId?: string;
  ruleReviewId?: string;
  provider: string;
  model: string;
  promptVersion?: string;
  inputJson?: unknown;
  run: () => Promise<{
    data: T;
    meta: {
      provider: string;
      model: string;
      latencyMs: number;
      promptVersion?: string;
    };
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      estimatedCostUsd?: number;
    };
  }>;
}) {
  const { aiRunLogId } = await saveAiRunLog({
    userId: params.userId,
    requestId: params.requestId,
    taskType: params.taskType,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sessionId: params.sessionId,
    ruleReviewId: params.ruleReviewId,
    provider: params.provider,
    model: params.model,
    promptVersion: params.promptVersion,
    inputJson: params.inputJson,
  });

  await logAiRunEvent({
    aiRunLogId,
    userId: params.userId,
    eventType: "started",
  });

  try {
    const result = await params.run();

    const estimatedCostUsd =
      result.usage.estimatedCostUsd ??
      (await estimateAiCostUsd({
        provider: result.meta.provider,
        model: result.meta.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      }));

    await updateAiRunLog({
      aiRunLogId,
      userId: params.userId,
      status: "succeeded",
      schemaValid: true,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd,
      latencyMs: result.meta.latencyMs,
      outputJson: result.data,
    });

    await logAiRunEvent({
      aiRunLogId,
      userId: params.userId,
      eventType: "completed",
    });

    return {
      ...result,
      aiRunLogId,
      estimatedCostUsd,
    };
  } catch (error) {
    const errorCode =
      error instanceof AIProviderError
        ? error.code
        : "AI_UNKNOWN_ERROR";

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown AI error";

    await updateAiRunLog({
      aiRunLogId,
      userId: params.userId,
      status:
        errorCode === "AI_PROVIDER_TIMEOUT"
          ? "timeout"
          : "failed",
      errorCode,
      errorMessage,
      errorDetails:
        error instanceof AIProviderError
          ? error.details
          : undefined,
    });

    await logAiRunEvent({
      aiRunLogId,
      userId: params.userId,
      eventType: "failed",
      message: errorMessage,
      metadata: {
        errorCode,
      },
    });

    throw error;
  }
}
