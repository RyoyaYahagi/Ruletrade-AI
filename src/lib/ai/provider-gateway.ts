import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { getOpenAiApiKey } from "./env";
import { validateAiOutput } from "./validate-ai-output";

export type TaskWeight = "light" | "standard" | "heavy";

const defaultModelByWeight: Record<TaskWeight, string> = {
  light: "gpt-5.4-nano",
  standard: "gpt-5.4-mini",
  heavy: "gpt-5.4",
};

export type AiProvider = "openai";

export type AiCallOptions<TOutput> = {
  provider?: AiProvider;
  model?: string;
  weight: TaskWeight;
  system?: string;
  prompt: string;
  outputSchema: z.ZodType<TOutput>;
  temperature?: number;
  maxTokens?: number;
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

function getClient(provider: AiProvider): OpenAI {
  if (provider === "openai") {
    return new OpenAI({ apiKey: getOpenAiApiKey() });
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}

function resolveModel(options: AiCallOptions<unknown>): {
  provider: AiProvider;
  model: string;
} {
  const provider = options.provider ?? "openai";
  const model = options.model ?? defaultModelByWeight[options.weight];
  return { provider, model };
}

export async function callAi<TOutput>(
  options: AiCallOptions<TOutput>,
): Promise<AiCallResult<TOutput>> {
  const { provider, model } = resolveModel(options);
  const client = getClient(provider);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: options.prompt });

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens,
      response_format: { type: "json_object" },
    });

    const choice = response.choices[0];
    const rawContent = choice?.message?.content ?? "";

    const usage: AiUsage = {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    };

    if (!rawContent) {
      return {
        ok: false,
        error: "AI returned empty content.",
        usage,
        model,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return {
        ok: false,
        error: `AI output is not valid JSON. Raw: ${rawContent.slice(0, 200)}`,
        usage,
        model,
      };
    }

    const parseResult = options.outputSchema.safeParse(parsed);

    if (!parseResult.success) {
      return {
        ok: false,
        error: `AI output schema validation failed: ${parseResult.error.message}`,
        usage,
        model,
      };
    }

    return {
      ok: true,
      data: parseResult.data,
      usage,
      model,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `AI provider call failed: ${message}`,
      model,
    };
  }
}
