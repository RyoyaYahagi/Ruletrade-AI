import "server-only";

import { z } from "zod";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import {
  resolveAIModelConfig,
  getConfiguredAIProvider,
} from "@/lib/ai/model-config";
import { withAiRunLogging } from "@/lib/ai/logs/with-ai-run-logging";
import type { AITaskType, AIAgentName, AIProvider } from "@/lib/ai/provider";
import type { AiRunSourceType } from "@/lib/ai/logs/ai-run-log-types";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { MockProvider } from "@/lib/ai/providers/mock-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { CodexAppServerProvider } from "@/lib/ai/providers/codex-app-server-provider";
import {
  recordProviderSuccess,
  recordProviderFailure,
  pickBestProvider,
  type HealthAiProvider,
} from "@/lib/ai/provider-health";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";

export type TaskWeight = "light" | "standard" | "heavy";

const defaultModelByWeight: Record<TaskWeight, string> = {
  light: "gpt-4.1-mini",
  standard: "gpt-4.1",
  heavy: "gpt-4.1",
};

export type AiProvider = "mock" | "openai" | "gemini" | "codex-app-server";

export type AiCallOptions<TOutput> = {
  provider?: AiProvider;
  model?: string;
  weight: TaskWeight;
  system?: string;
  prompt: string;
  outputSchema: z.ZodType<TOutput>;
  temperature?: number;
  maxTokens?: number;
  taskType?: AITaskType;
  agentName?: AIAgentName;
  promptVersion?: string;
  schemaName?: string;
  // Observability options
  userId?: string;
  requestId?: string;
  sourceType?: AiRunSourceType;
  sourceId?: string;
  sessionId?: string;
  ruleReviewId?: string;
  inputJson?: unknown;
};

export type AiUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AiCallResult<T> =
  | {
      ok: true;
      data: T;
      usage: AiUsage;
      model: string;
      aiRunLogId?: string;
      estimatedCostUsd?: number;
    }
  | {
      ok: false;
      error: string;
      usage?: AiUsage;
      model?: string;
      aiRunLogId?: string;
    };

export async function callAi<TOutput>(
  options: AiCallOptions<TOutput>,
): Promise<AiCallResult<TOutput>> {
  const shouldLog = !!options.userId;

  const result = shouldLog
    ? await callAiWithLogging(options)
    : await callAiWithoutLogging(options);

  if (result.ok) {
    const safety = runSafetyCheck({ text: JSON.stringify(result.data) });
    if (!safety.passed) {
      return {
        ok: false,
        error: `AI output blocked by safety check: ${safety.violations.map((v) => v.phrase).join(", ")}`,
        model: result.model,
        aiRunLogId: result.aiRunLogId,
      };
    }
  }

  return result;
}

async function callAiWithLogging<TOutput>(
  options: AiCallOptions<TOutput>,
): Promise<AiCallResult<TOutput>> {
  try {
    // Resolve model config via routing when taskType is provided
    const resolvedConfig = options.taskType
      ? resolveAIModelConfig({
          taskType: options.taskType,
          agentName: options.agentName,
        })
      : undefined;

    const providerName: string =
      options.provider ?? resolvedConfig?.provider ?? getConfiguredAIProvider();
    const modelName: string =
      options.model ??
      resolvedConfig?.model ??
      defaultModelByWeight[options.weight];
    const temperature =
      options.temperature ?? resolvedConfig?.temperature ?? 0.4;
    const maxOutputTokens =
      options.maxTokens ?? resolvedConfig?.maxOutputTokens ?? 2048;

    const provider = getProviderForCall(providerName as AiProvider);

    const result = await withAiRunLogging({
      userId: options.userId!,
      requestId: options.requestId,
      taskType: options.taskType ?? "eval_judge",
      sourceType: options.sourceType,
      sourceId: options.sourceId,
      sessionId: options.sessionId,
      ruleReviewId: options.ruleReviewId,
      provider: providerName,
      model: modelName,
      promptVersion: options.promptVersion,
      inputJson: options.inputJson,
      metadata: resolvedConfig
        ? {
            agentName: resolvedConfig.agentName,
            costTier: resolvedConfig.costTier,
            fallbackUsed: false,
            temperature: resolvedConfig.temperature,
            maxOutputTokens: resolvedConfig.maxOutputTokens,
          }
        : undefined,
      run: async () => {
        const start = performance.now();
        const aiResult = await provider.generateObject({
          taskType: options.taskType ?? "eval_judge",
          agentName: options.agentName,
          schema: options.outputSchema,
          schemaName: options.schemaName ?? "AiCallOutput",
          promptVersion: options.promptVersion,
          temperature,
          maxOutputTokens,
          messages: [
            ...(options.system
              ? [{ role: "system" as const, content: options.system }]
              : []),
            { role: "user" as const, content: options.prompt },
          ],
        });
        const latencyMs = Math.round(performance.now() - start);

        return {
          data: aiResult.data,
          meta: {
            provider: providerName,
            model: aiResult.meta.model || modelName,
            latencyMs,
            promptVersion: options.promptVersion,
          },
          usage: {
            inputTokens: aiResult.usage.inputTokens,
            outputTokens: aiResult.usage.outputTokens,
            estimatedCostUsd: aiResult.usage.estimatedCostUsd,
          },
        };
      },
    });

    return {
      ok: true,
      data: result.data,
      usage: {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens:
          (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      },
      model: result.meta.model,
      aiRunLogId: result.aiRunLogId,
      estimatedCostUsd: result.estimatedCostUsd,
    };
  } catch (error) {
    const message =
      error instanceof AIProviderError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    return {
      ok: false,
      error: `AI provider call failed: ${message}`,
      model: options.model ?? defaultModelByWeight[options.weight],
    };
  }
}

async function callAiWithoutLogging<TOutput>(
  options: AiCallOptions<TOutput>,
): Promise<AiCallResult<TOutput>> {
  const resolvedConfig = options.taskType
    ? resolveAIModelConfig({
        taskType: options.taskType,
        agentName: options.agentName,
      })
    : undefined;

  const candidates = getProviderCandidates(options.provider);

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const provider = instantiateProvider(candidate);
      const modelName: string =
        options.model ??
        resolvedConfig?.model ??
        defaultModelByWeight[options.weight];
      const temperature =
        options.temperature ?? resolvedConfig?.temperature ?? 0.4;
      const maxOutputTokens =
        options.maxTokens ?? resolvedConfig?.maxOutputTokens ?? 2048;

      const start = performance.now();
      const result = await provider.generateObject({
        taskType: options.taskType ?? "eval_judge",
        agentName: options.agentName,
        schema: options.outputSchema,
        schemaName: options.schemaName ?? "AiCallOutput",
        promptVersion: options.promptVersion,
        temperature,
        maxOutputTokens,
        messages: [
          ...(options.system
            ? [{ role: "system" as const, content: options.system }]
            : []),
          { role: "user" as const, content: options.prompt },
        ],
      });
      const latencyMs = Math.round(performance.now() - start);
      recordProviderSuccess(candidate, latencyMs);

      return {
        ok: true,
        data: result.data,
        usage: {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
        },
        model: result.meta.model || modelName,
      };
    } catch (error) {
      lastError = error;
      recordProviderFailure(candidate);
    }
  }

  const message =
    lastError instanceof AIProviderError
      ? `${lastError.code}: ${lastError.message}`
      : lastError instanceof Error
        ? lastError.message
        : String(lastError);

  return {
    ok: false,
    error: `AI provider call failed: ${message}`,
    model:
      options.model ??
      resolvedConfig?.model ??
      defaultModelByWeight[options.weight],
  };
}

function getProviderForCall(provider?: AiProvider): AIProvider {
  if (provider) {
    return instantiateProvider(provider);
  }
  const configured = process.env.AI_PROVIDER;
  if (
    configured === "mock" ||
    configured === "openai" ||
    configured === "gemini" ||
    configured === "codex-app-server"
  ) {
    return instantiateProvider(configured);
  }
  const best = pickBestProvider([
    "openai",
    "gemini",
    "codex-app-server",
    "mock",
  ]);
  if (!best) {
    throw new AIProviderError(
      "AI_PROVIDER_REQUEST_FAILED",
      "All providers are unavailable (circuit open or not configured).",
    );
  }
  return instantiateProvider(best);
}

function instantiateProvider(provider: AiProvider): AIProvider {
  switch (provider) {
    case "mock":
      return new MockProvider();
    case "openai":
      return new OpenAIProvider();
    case "gemini":
      return new GeminiProvider();
    case "codex-app-server":
      return new CodexAppServerProvider();
    default: {
      const configured = getConfiguredAIProvider();
      return instantiateProvider(configured as AiProvider);
    }
  }
}

function getProviderCandidates(preferred?: AiProvider): HealthAiProvider[] {
  const all: HealthAiProvider[] = [
    "openai",
    "gemini",
    "codex-app-server",
    "mock",
  ];
  if (!preferred) return all;
  // Put preferred first, then others
  return [preferred, ...all.filter((p) => p !== preferred)];
}
