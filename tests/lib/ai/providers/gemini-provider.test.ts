import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import { RuleReviewSchema } from "@/schemas/rules/rule-review-schema";

const mockFetch = vi.fn();

describe("GeminiProvider", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-api-key");
    global.fetch = mockFetch;
    vi.stubEnv("AI_TIMEOUT_MS", "30000");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const dummySchema = z.object({ result: z.string() });

  function createSuccessResponse(text: string, usage?: object) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
          ...usage,
        },
      }),
      text: async () => text,
    };
  }

  describe("constructor", () => {
    it("APIキー未設定時に AIProviderError を投げる", () => {
      vi.unstubAllEnvs();
      vi.stubEnv("GEMINI_API_KEY", undefined);
      expect(() => new GeminiProvider()).toThrow(AIProviderError);
      expect(() => new GeminiProvider()).toThrow("GEMINI_API_KEY is not set.");
    });
  });

  describe("generateObject", () => {
    it("正常系: JSONレスポンスをパースして返す", async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse('{"result": "hello"}'),
      );

      const provider = new GeminiProvider();
      const result = await provider.generateObject({
        taskType: "eval",
        schema: dummySchema,
        schemaName: "TestSchema",
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.data).toEqual({ result: "hello" });
      expect(result.rawText).toBe('{"result": "hello"}');
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(result.meta.provider).toBe("gemini");
    });

    it("RuleReview uses Gemini responseSchema", async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse(
          JSON.stringify({
            summary: "追加確認が必要です。",
            completionScore: 35,
            needsMoreInfo: true,
            canFinalize: false,
            qualityChecks: [],
            nextQuestions: [],
            suggestedRuleUpdates: [],
            safety: {
              passed: true,
              riskLevel: "low",
              violations: [],
              prohibitedPhrasesDetected: [],
            },
          }),
        ),
      );

      const provider = new GeminiProvider();
      await provider.generateObject({
        taskType: "rule_review",
        schema: RuleReviewSchema,
        schemaName: "RuleReview",
        messages: [{ role: "user", content: "test" }],
      });

      const lastCall = mockFetch.mock.calls.at(-1);
      const body = JSON.parse(String(lastCall?.[1]?.body));
      expect(body.generationConfig.responseMimeType).toBe("application/json");
      expect(body.generationConfig.responseSchema).toMatchObject({
        type: "OBJECT",
        properties: {
          summary: { type: "STRING" },
          qualityChecks: expect.any(Object),
          nextQuestions: {
            items: {
              properties: {
                options: {
                  type: "ARRAY",
                  items: {
                    properties: {
                      value: { type: "STRING" },
                      label: { type: "STRING" },
                    },
                  },
                },
              },
            },
          },
        },
      });
      expect(JSON.stringify(body.generationConfig.responseSchema)).not.toContain(
        "$ref",
      );
    });

    it("HTTPエラー (429) で AI_PROVIDER_RATE_LIMITED を投げる", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "rate limited",
      });

      const provider = new GeminiProvider();
      await expect(
        provider.generateObject({
          taskType: "eval",
          schema: dummySchema,
          schemaName: "TestSchema",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow("Gemini API request failed.");
    });

    it("HTTPエラー (500) で AI_PROVIDER_REQUEST_FAILED を投げる", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "server error",
      });

      const provider = new GeminiProvider();
      await expect(
        provider.generateObject({
          taskType: "eval",
          schema: dummySchema,
          schemaName: "TestSchema",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow(AIProviderError);
    });

    it("JSONパース失敗で AI_OUTPUT_PARSE_FAILED を投げる", async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse("not json"));

      const provider = new GeminiProvider();
      await expect(
        provider.generateObject({
          taskType: "eval",
          schema: dummySchema,
          schemaName: "TestSchema",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow("Gemini output was not valid JSON.");
    });

    it("スキーマ不一致で AI_OUTPUT_SCHEMA_INVALID を投げる", async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse('{"result": 123}'));

      const provider = new GeminiProvider();
      await expect(
        provider.generateObject({
          taskType: "eval",
          schema: dummySchema,
          schemaName: "TestSchema",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow("Gemini output did not match schema.");
    });
  });

  describe("generateText", () => {
    it("正常系: テキストを返す", async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse("Hello world"));

      const provider = new GeminiProvider();
      const result = await provider.generateText({
        taskType: "eval",
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.text).toBe("Hello world");
      expect(result.meta.provider).toBe("gemini");
    });

    it("HTTPエラーで AIProviderError を投げる", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => "forbidden",
      });

      const provider = new GeminiProvider();
      await expect(
        provider.generateText({
          taskType: "eval",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow(AIProviderError);
    });
  });
});
