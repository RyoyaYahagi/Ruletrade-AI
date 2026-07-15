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

const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRY_DELAYS_MS = [500, 1500] as const;

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
        responseSchema: getGeminiResponseSchema(params.schemaName),
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
          agentName: params.agentName,
          promptVersion: params.promptVersion,
          fallbackUsed: false,
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
          agentName: params.agentName,
          promptVersion: params.promptVersion,
          fallbackUsed: false,
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
      responseSchema?: unknown;
    },
  ): Promise<GeminiGenerateContentResponse> {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    );

    const controller = new AbortController();

    let response: Response | undefined;

    for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt += 1) {
      response = await withTimeout(
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
              responseSchema: options.responseSchema,
            },
          }),
          signal: controller.signal,
        }),
        getAITimeoutMs(),
        controller,
      );

      if (
        !isRetryableGeminiStatus(response.status) ||
        attempt === GEMINI_MAX_ATTEMPTS - 1
      ) {
        break;
      }

      await delay(GEMINI_RETRY_DELAYS_MS[attempt] ?? 0);
    }

    if (!response) {
      throw new AIProviderError(
        "AI_PROVIDER_REQUEST_FAILED",
        "Gemini API request failed.",
      );
    }

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

function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || status === 503;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function getGeminiResponseSchema(schemaName: string): unknown {
  if (schemaName !== "RuleReview") return undefined;

  return {
    type: "OBJECT",
    required: [
      "summary",
      "completionScore",
      "needsMoreInfo",
      "canFinalize",
      "qualityChecks",
      "nextQuestions",
      "suggestedRuleUpdates",
      "safety",
    ],
    properties: {
      summary: { type: "STRING" },
      completionScore: { type: "NUMBER" },
      needsMoreInfo: { type: "BOOLEAN" },
      canFinalize: { type: "BOOLEAN" },
      qualityChecks: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          required: ["checkKey", "label", "status", "severity", "reason"],
          properties: {
            checkKey: { type: "STRING" },
            label: { type: "STRING" },
            status: { type: "STRING", enum: ["pass", "warning", "fail"] },
            severity: { type: "STRING", enum: ["low", "medium", "high"] },
            reason: { type: "STRING" },
            suggestedQuestion: { type: "STRING" },
          },
        },
      },
      nextQuestions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          required: [
            "questionKey",
            "questionText",
            "questionType",
            "priority",
            "isRequired",
            "source",
            "status",
            "displayOrder",
          ],
          properties: {
            questionKey: { type: "STRING" },
            questionText: { type: "STRING" },
            questionType: {
              type: "STRING",
              enum: ["free_text", "single_choice", "multi_choice"],
            },
            options: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                required: ["value", "label"],
                properties: {
                  value: { type: "STRING" },
                  label: { type: "STRING" },
                },
              },
            },
            priority: { type: "INTEGER" },
            isRequired: { type: "BOOLEAN" },
            mapsToRuleField: { type: "STRING" },
            source: { type: "STRING", enum: ["ai", "system", "user"] },
            status: {
              type: "STRING",
              enum: ["pending", "answered", "skipped"],
            },
            displayOrder: { type: "INTEGER" },
            helpText: { type: "STRING" },
          },
        },
      },
      suggestedRuleUpdates: {
        type: "ARRAY",
        items: { type: "OBJECT" },
      },
      safety: {
        type: "OBJECT",
        required: ["passed", "riskLevel", "violations", "prohibitedPhrasesDetected"],
        properties: {
          passed: { type: "BOOLEAN" },
          riskLevel: { type: "STRING", enum: ["low", "medium", "high"] },
          violations: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              required: ["type", "reason"],
              properties: {
                type: {
                  type: "STRING",
                  enum: [
                    "buy_recommendation",
                    "sell_recommendation",
                    "price_prediction",
                    "profit_guarantee",
                    "loss_avoidance_guarantee",
                    "decision_delegation",
                    "urgency_pressure",
                    "fear_mongering",
                    "privacy_risk",
                    "other",
                  ],
                },
                phrase: { type: "STRING" },
                reason: { type: "STRING" },
              },
            },
          },
          prohibitedPhrasesDetected: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          suggestedRewrite: { type: "STRING" },
        },
      },
    },
  };
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
