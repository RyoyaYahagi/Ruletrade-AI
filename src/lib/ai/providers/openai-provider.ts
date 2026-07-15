import "server-only";

import OpenAI from "openai";
import type { z } from "zod";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import { getAITimeoutMs, getOpenAIModel } from "@/lib/ai/model-config";
import type {
  AIMessage,
  AIProvider,
  GenerateObjectParams,
  GenerateObjectResult,
  GenerateTextParams,
  GenerateTextResult,
} from "@/lib/ai/provider";
import { normalizeAIUsage } from "@/lib/ai/usage/token-usage";
import { withTimeout } from "@/lib/ai/with-timeout";

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private readonly selectedModel?: string;

  constructor(model?: string) {
    this.selectedModel = model;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new AIProviderError(
        "AI_PROVIDER_NOT_CONFIGURED",
        "OPENAI_API_KEY is not set.",
      );
    }

    this.client = new OpenAI({ apiKey });
  }

  async generateObject<TSchema extends z.ZodType>(
    params: GenerateObjectParams<TSchema>,
  ): Promise<GenerateObjectResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    const model = this.selectedModel ?? getOpenAIModel();

    try {
      const response = await withTimeout(
        this.client.chat.completions.create({
          model,
          messages: toOpenAIMessages(params.messages, params.schemaName),
          temperature: params.temperature ?? 0.2,
          max_tokens: params.maxOutputTokens,
          response_format: { type: "json_object" },
        }),
        getAITimeoutMs(),
      );
      const rawText = response.choices[0]?.message.content ?? "";
      const parsedJson = parseJson(rawText, "OpenAI");
      const parsed = params.schema.safeParse(parsedJson);

      if (!parsed.success) {
        throw new AIProviderError(
          "AI_OUTPUT_SCHEMA_INVALID",
          "OpenAI output did not match schema.",
          parsed.error.flatten(),
        );
      }

      return {
        data: parsed.data,
        rawText,
        usage: normalizeAIUsage({
          inputTokens: response.usage?.prompt_tokens,
          outputTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        }),
        meta: {
          provider: "openai",
          model,
          taskType: params.taskType,
          agentName: params.agentName,
          promptVersion: params.promptVersion,
          fallbackUsed: false,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      throw normalizeProviderError(error, "OpenAI request failed.");
    }
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const startedAt = Date.now();
    const model = this.selectedModel ?? getOpenAIModel();

    try {
      const response = await withTimeout(
        this.client.chat.completions.create({
          model,
          messages: params.messages,
          temperature: params.temperature ?? 0.2,
          max_tokens: params.maxOutputTokens,
        }),
        getAITimeoutMs(),
      );

      return {
        text: response.choices[0]?.message.content ?? "",
        usage: normalizeAIUsage({
          inputTokens: response.usage?.prompt_tokens,
          outputTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        }),
        meta: {
          provider: "openai",
          model,
          taskType: params.taskType,
          agentName: params.agentName,
          promptVersion: params.promptVersion,
          fallbackUsed: false,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      throw normalizeProviderError(error, "OpenAI text generation failed.");
    }
  }
}

function toOpenAIMessages(
  messages: AIMessage[],
  schemaName: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return [
    ...messages,
    {
      role: "user",
      content: `Return only valid JSON matching the ${schemaName} schema.`,
    },
  ];
}

function parseJson(rawText: string, providerName: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new AIProviderError(
      "AI_OUTPUT_PARSE_FAILED",
      `${providerName} output was not valid JSON.`,
      { rawText, error },
    );
  }
}

function normalizeProviderError(
  error: unknown,
  message: string,
): AIProviderError {
  if (error instanceof AIProviderError) {
    return error;
  }

  return new AIProviderError(
    "AI_PROVIDER_REQUEST_FAILED",
    message,
    error,
    true,
  );
}
