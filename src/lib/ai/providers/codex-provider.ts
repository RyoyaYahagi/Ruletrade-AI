import "server-only";

import OpenAI from "openai";
import type { z } from "zod";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import { getAITimeoutMs } from "@/lib/ai/model-config";
import type {
  AIProvider,
  GenerateObjectParams,
  GenerateObjectResult,
  GenerateTextParams,
  GenerateTextResult,
} from "@/lib/ai/provider";
import { normalizeAIUsage } from "@/lib/ai/usage/token-usage";
import { withTimeout } from "@/lib/ai/with-timeout";

const DEFAULT_CODEX_MODEL = "gpt-5.2-codex";

export function getCodexModel(): string {
  return process.env.OPENAI_CODEX_MODEL || DEFAULT_CODEX_MODEL;
}

export class CodexProvider implements AIProvider {
  private client: OpenAI;

  constructor() {
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
    const model = getCodexModel();

    try {
      const input = buildInput(params.messages, params.schemaName);

      const response = await withTimeout(
        this.client.responses.create({
          model,
          input,
          temperature: params.temperature ?? 0.2,
          max_output_tokens: params.maxOutputTokens,
          text: { format: { type: "json_object" } },
        }),
        getAITimeoutMs(),
      );

      const rawText = response.output_text;
      const parsedJson = parseJson(rawText);
      const parsed = params.schema.safeParse(parsedJson);

      if (!parsed.success) {
        throw new AIProviderError(
          "AI_OUTPUT_SCHEMA_INVALID",
          "Codex output did not match schema.",
          parsed.error.flatten(),
        );
      }

      return {
        data: parsed.data,
        rawText,
        usage: normalizeAIUsage({
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          totalTokens: response.usage?.total_tokens,
        }),
        meta: {
          provider: "codex",
          model,
          taskType: params.taskType,
          promptVersion: params.promptVersion,
          fallbackUsed: false,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw normalizeProviderError(error);
    }
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const startedAt = Date.now();
    const model = getCodexModel();

    try {
      const input = buildInput(params.messages);

      const response = await withTimeout(
        this.client.responses.create({
          model,
          input,
          temperature: params.temperature ?? 0.2,
          max_output_tokens: params.maxOutputTokens,
        }),
        getAITimeoutMs(),
      );

      return {
        text: response.output_text,
        usage: normalizeAIUsage({
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          totalTokens: response.usage?.total_tokens,
        }),
        meta: {
          provider: "codex",
          model,
          taskType: params.taskType,
          promptVersion: params.promptVersion,
          fallbackUsed: false,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw normalizeProviderError(error);
    }
  }
}

function buildInput(
  messages: Array<{ role: string; content: string }>,
  schemaName?: string,
): string {
  const parts = messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`);
  if (schemaName) {
    parts.push(`Return only valid JSON matching the ${schemaName} schema.`);
  }
  return parts.join("\n\n");
}

function parseJson(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch {
    throw new AIProviderError(
      "AI_OUTPUT_PARSE_FAILED",
      "Codex output was not valid JSON.",
      { rawText },
    );
  }
}

function normalizeProviderError(error: unknown): AIProviderError {
  if (error instanceof OpenAI.APIError) {
    return new AIProviderError(
      error.status === 429
        ? "AI_PROVIDER_RATE_LIMITED"
        : "AI_PROVIDER_REQUEST_FAILED",
      "Codex API request failed.",
      { status: error.status, message: error.message },
      error.status >= 500 || error.status === 429,
    );
  }
  return new AIProviderError(
    "AI_PROVIDER_REQUEST_FAILED",
    "Codex request failed.",
    error,
    true,
  );
}
