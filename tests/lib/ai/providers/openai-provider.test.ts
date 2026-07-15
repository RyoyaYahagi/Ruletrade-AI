import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { AIProviderError } from "@/lib/ai/ai-provider-error";

const mockCreate = vi.fn();
vi.mock("openai", () => {
  return {
    default: class {
      constructor() {
        return {
          chat: {
            completions: {
              create: mockCreate,
            },
          },
        };
      }
    },
  };
});

describe("OpenAIProvider", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("AI_TIMEOUT_MS", "30000");
    mockCreate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const dummySchema = z.object({ result: z.string() });

  function createSuccessResponse(text: string, usage?: object) {
    return Promise.resolve({
      choices: [
        {
          message: {
            content: text,
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        ...usage,
      },
    });
  }

  describe("constructor", () => {
    it("APIキー未設定時に AIProviderError を投げる", () => {
      vi.unstubAllEnvs();
      vi.stubEnv("OPENAI_API_KEY", undefined);
      expect(() => new OpenAIProvider()).toThrow(AIProviderError);
      expect(() => new OpenAIProvider()).toThrow("OPENAI_API_KEY is not set.");
    });
  });

  describe("generateObject", () => {
    it("正常系: JSONレスポンスをパースして返す", async () => {
      mockCreate.mockResolvedValueOnce(
        createSuccessResponse('{"result": "hello"}'),
      );

      const provider = new OpenAIProvider();
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
      expect(result.meta.provider).toBe("openai");
    });

    it("APIエラーで AIProviderError を投げる", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Rate limit exceeded"));

      const provider = new OpenAIProvider();
      await expect(
        provider.generateObject({
          taskType: "eval",
          schema: dummySchema,
          schemaName: "TestSchema",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow(AIProviderError);

      try {
        await provider.generateObject({
          taskType: "eval",
          schema: dummySchema,
          schemaName: "TestSchema",
          messages: [{ role: "user", content: "test" }],
        });
      } catch (error) {
        expect((error as AIProviderError).code).toBe(
          "AI_PROVIDER_REQUEST_FAILED",
        );
      }
    });

    it("JSONパース失敗で AI_OUTPUT_PARSE_FAILED を投げる", async () => {
      mockCreate.mockResolvedValueOnce(createSuccessResponse("not json"));

      const provider = new OpenAIProvider();
      await expect(
        provider.generateObject({
          taskType: "eval",
          schema: dummySchema,
          schemaName: "TestSchema",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow("OpenAI output was not valid JSON.");
    });

    it("スキーマ不一致で AI_OUTPUT_SCHEMA_INVALID を投げる", async () => {
      mockCreate.mockResolvedValueOnce(
        createSuccessResponse('{"result": 123}'),
      );

      const provider = new OpenAIProvider();
      await expect(
        provider.generateObject({
          taskType: "eval",
          schema: dummySchema,
          schemaName: "TestSchema",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow("OpenAI output did not match schema.");
    });
  });

  describe("generateText", () => {
    it("正常系: テキストを返す", async () => {
      mockCreate.mockResolvedValueOnce(createSuccessResponse("Hello world"));

      const provider = new OpenAIProvider();
      const result = await provider.generateText({
        taskType: "eval",
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.text).toBe("Hello world");
      expect(result.meta.provider).toBe("openai");
    });

    it("APIエラーで AIProviderError を投げる", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Internal server error"));

      const provider = new OpenAIProvider();
      await expect(
        provider.generateText({
          taskType: "eval",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow(AIProviderError);
    });
  });
});
