import "server-only";

import { z } from "zod";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import { getAIProvider } from "@/lib/ai/provider-factory";
import type { AITaskType, AIProvider } from "@/lib/ai/provider";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { MockProvider } from "@/lib/ai/providers/mock-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";

export type TaskWeight = "light" | "standard" | "heavy";

const defaultModelByWeight: Record<TaskWeight, string> = {
  light: "gpt-4.1-mini",
  standard: "gpt-4.1",
  heavy: "gpt-4.1",
};

export type AiProvider = "mock" | "openai" | "gemini";

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
  promptVersion?: string;
  schemaName?: string;
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
    }
  | {
      ok: false;
      error: string;
      usage?: AiUsage;
      model?: string;
    };

export async function callAi<TOutput>(
  options: AiCallOptions<TOutput>,
): Promise<AiCallResult<TOutput>> {
  try {
    const provider = getProviderForCall(options.provider);
    const result = await provider.generateObject({
      taskType: options.taskType ?? "eval",
      schema: options.outputSchema,
      schemaName: options.schemaName ?? "AiCallOutput",
      promptVersion: options.promptVersion,
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      messages: [
        ...(options.system
          ? [{ role: "system" as const, content: options.system }]
          : []),
        { role: "user" as const, content: options.prompt },
      ],
    });

    return {
      ok: true,
      data: result.data,
      usage: {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      },
      model: result.meta.model || options.model || defaultModelByWeight[options.weight],
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

function getProviderForCall(provider?: AiProvider): AIProvider {
  switch (provider) {
    case "mock":
      return new MockProvider();
    case "openai":
      return new OpenAIProvider();
    case "gemini":
      return new GeminiProvider();
    default:
      return getAIProvider();
  }
}
