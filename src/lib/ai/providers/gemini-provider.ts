import "server-only";

import type { z } from "zod";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import { getAITimeoutMs, getGeminiModel } from "@/lib/ai/model-config";
import type {
  AIProvider,
  GenerateObjectParams,
  GenerateObjectResult,
  GenerateTextParams,
  GenerateTextResult,
} from "@/lib/ai/provider";
import { normalizeAIUsage } from "@/lib/ai/usage/token-usage";
import { withTimeout } from "@/lib/ai/with-timeout";

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export class GeminiProvider implements AIProvider {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new AIProviderError(
        "AI_PROVIDER_NOT_CONFIGURED",
        "GEMINI_API_KEY is not set.",
      );
    }

    this.apiKey = apiKey;
  }

  async generateObject<TSchema extends z.ZodType>(
    params: GenerateObjectParams<TSchema>,
  ): Promise<GenerateObjectResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    const model = getGeminiModel();

    try {
      const response = await this.generateContent(model, {
        prompt: toGeminiPrompt(params.messages, params.schemaName),
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxOutputTokens,
        responseMimeType: "application/json",
      });
      const rawText = getGeminiText(response);
      const parsedJson = parseJson(rawText);
      const parsed = params.schema.safeParse(parsedJson);

      if (!parsed.success) {
        throw new AIProviderError(
          "AI_OUTPUT_SCHEMA_INVALID",
          "Gemini output did not match schema.",
          parsed.error.flatten(),
        );
      }

      return {
        data: parsed.data,
        rawText,
        usage: getGeminiUsage(response),
        meta: {
          provider: "gemini",
          model,
          taskType: params.taskType,
          promptVersion: params.promptVersion,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      throw normalizeProviderError(error, "Gemini request failed.");
    }
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const startedAt = Date.now();
    const model = getGeminiModel();

    try {
      const response = await this.generateContent(model, {
        prompt: toGeminiPrompt(params.messages),
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxOutputTokens,
      });

      return {
        text: getGeminiText(response),
        usage: getGeminiUsage(response),
        meta: {
          provider: "gemini",
          model,
          taskType: params.taskType,
          promptVersion: params.promptVersion,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      throw normalizeProviderError(error, "Gemini text generation failed.");
    }
  }

  private async generateContent(
    model: string,
    options: {
      prompt: string;
      temperature: number;
      maxOutputTokens?: number;
      responseMimeType?: "application/json";
    },
  ): Promise<GeminiGenerateContentResponse> {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    );

    const controller = new AbortController();

    const response = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: options.prompt }] }],
          generationConfig: {
            temperature: options.temperature,
            maxOutputTokens: options.maxOutputTokens,
            responseMimeType: options.responseMimeType,
          },
        }),
        signal: controller.signal,
      }),
      getAITimeoutMs(),
      controller,
    );

    if (!response.ok) {
      throw new AIProviderError(
        response.status === 429
          ? "AI_PROVIDER_RATE_LIMITED"
          : "AI_PROVIDER_REQUEST_FAILED",
        "Gemini API request failed.",
        { status: response.status, body: await response.text() },
        response.status >= 500 || response.status === 429,
      );
    }

    return (await response.json()) as GeminiGenerateContentResponse;
  }
}

function toGeminiPrompt(
  messages: Array<{ role: string; content: string }>,
  schemaName?: string,
): string {
  const prompt = messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");

  if (!schemaName) {
    return prompt;
  }

  return `${prompt}\n\nReturn only valid JSON matching the ${schemaName} schema.`;
}

function getGeminiText(response: GeminiGenerateContentResponse): string {
  return response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function getGeminiUsage(response: GeminiGenerateContentResponse) {
  return normalizeAIUsage({
    inputTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount,
    totalTokens: response.usageMetadata?.totalTokenCount,
  });
}

function parseJson(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new AIProviderError(
      "AI_OUTPUT_PARSE_FAILED",
      "Gemini output was not valid JSON.",
      { rawText, error },
    );
  }
}

function normalizeProviderError(error: unknown, message: string): AIProviderError {
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
