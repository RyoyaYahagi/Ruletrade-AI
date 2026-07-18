import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { callAi } from "@/lib/ai/provider-gateway";
import { getAiDeveloperSettings } from "@/features/ai/services/ai-developer-settings-service";

vi.mock("@/features/ai/services/ai-developer-settings-service", () => ({
  getAiDeveloperSettings: vi.fn(),
}));

const mockFetch = vi.fn();

describe("provider-gateway", () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("AI_TIMEOUT_MS", "30000");
    mockFetch.mockReset();
    vi.mocked(getAiDeveloperSettings).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const outputSchema = z.object({ answer: z.string() });

  function createMockResponse(data: object, usage?: object) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(data) }],
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
    };
  }

  describe("callAi without logging", () => {
    it("正常系: データと usage を返す", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ answer: "yes" }));

      const result = await callAi({
        weight: "light",
        prompt: "test prompt",
        outputSchema,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ answer: "yes" });
        expect(result.usage.promptTokens).toBe(10);
        expect(result.usage.completionTokens).toBe(5);
        expect(result.usage.totalTokens).toBe(15);
        expect(result.model).toBe("gemini-2.5-flash");
      }
    });

    it("provider 指定で GeminiProvider を使う", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ answer: "gemini" }));

      const result = await callAi({
        provider: "gemini",
        weight: "light",
        prompt: "test prompt",
        outputSchema,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ answer: "gemini" });
      }
    });

    it("provider 指定で MockProvider を使う", async () => {
      const result = await callAi({
        provider: "mock",
        weight: "light",
        prompt: "test prompt",
        outputSchema: z.object({}),
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({});
      }
    });

    it("エラー時に ok: false を返す", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "server error",
      });

      const result = await callAi({
        provider: "gemini",
        weight: "light",
        prompt: "test prompt",
        outputSchema,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("AI provider call failed");
        expect(result.model).toBe("gpt-4.1-mini");
      }
    });

    it("モデル指定が優先される", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ answer: "custom" }));

      const result = await callAi({
        provider: "gemini",
        model: "custom-model",
        weight: "light",
        prompt: "test prompt",
        outputSchema,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ answer: "custom" });
        expect(result.model).toBe("custom-model");
      }
    });
  });

  describe("callAi with logging", () => {
    it("userId ありでログ付き実行", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ answer: "logged" }));

      const result = await callAi({
        weight: "light",
        prompt: "test prompt",
        outputSchema,
        userId: "user-123",
        requestId: "req-456",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ answer: "logged" });
      }
    });

    it("ユーザーに保存された provider と model を適用する", async () => {
      vi.mocked(getAiDeveloperSettings).mockResolvedValue({
        provider: "gemini",
        model: "configured-gemini-model",
      });
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ answer: "configured" }),
      );

      const result = await callAi({
        taskType: "rule_draft_generation",
        weight: "standard",
        prompt: "test prompt",
        outputSchema,
        userId: "user-123",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.model).toBe("configured-gemini-model");
      }
      expect(String(mockFetch.mock.calls[0]?.[0])).toContain(
        "/models/configured-gemini-model:generateContent",
      );
    });
  });
});
