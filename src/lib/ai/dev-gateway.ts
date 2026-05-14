import OpenAI from "openai";
import { z } from "zod";
import { getOpenAiApiKey, getOpenRouterApiKey } from "./dev-env";

export type DevPhase =
  | "investigation"
  | "summarization"
  | "planning"
  | "implementation"
  | "review"
  | "finalCheck"
  | "lead"
  | "escalation";

export const devPhaseModels: Record<
  DevPhase,
  { provider: "openai" | "openrouter"; model: string }
> = {
  investigation: { provider: "openai", model: "gpt-5.4-mini" },
  summarization: { provider: "openai", model: "gpt-5.4-mini" },
  planning: { provider: "openrouter", model: "kimi-k2.6" },
  implementation: { provider: "openrouter", model: "kimi-k2.6" },
  review: { provider: "openrouter", model: "kimi-k2.6" },
  finalCheck: { provider: "openai", model: "gpt-5.5-low" },
  lead: { provider: "openai", model: "gpt-5.4-medium" },
  escalation: { provider: "openai", model: "gpt-5.5-low" },
};

export type DevAiUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type DevAiResult<T> =
  | { ok: true; data: T; usage: DevAiUsage; model: string }
  | { ok: false; error: string; model?: string };

function getClient(
  provider: "openai" | "openrouter",
): { client: OpenAI; modelPrefix: string } {
  if (provider === "openai") {
    return {
      client: new OpenAI({ apiKey: getOpenAiApiKey() }),
      modelPrefix: "",
    };
  }
  return {
    client: new OpenAI({
      apiKey: getOpenRouterApiKey(),
      baseURL: "https://openrouter.ai/api/v1",
    }),
    modelPrefix: "",
  };
}

export async function callDevAi<TOutput>({
  phase,
  system,
  prompt,
  outputSchema,
  temperature = 0.4,
  maxTokens,
}: {
  phase: DevPhase;
  system?: string;
  prompt: string;
  outputSchema: z.ZodType<TOutput>;
  temperature?: number;
  maxTokens?: number;
}): Promise<DevAiResult<TOutput>> {
  const config = devPhaseModels[phase];
  const { client } = getClient(config.provider);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (system) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: prompt });

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    const choice = response.choices[0];
    const rawContent = choice?.message?.content ?? "";

    const usage: DevAiUsage = {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    };

    if (!rawContent) {
      return {
        ok: false,
        error: "AI returned empty content.",
        model: config.model,
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
        model: config.model,
      };
    }

    const parseResult = outputSchema.safeParse(parsed);

    if (!parseResult.success) {
      return {
        ok: false,
        error: `AI output schema validation failed: ${parseResult.error.message}`,
        usage,
        model: config.model,
      };
    }

    return {
      ok: true,
      data: parseResult.data,
      usage,
      model: config.model,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `AI provider call failed: ${message}`,
      model: config.model,
    };
  }
}
