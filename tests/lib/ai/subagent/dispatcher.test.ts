import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  dispatchSubAgent,
  runInvestigator,
  runSummarizer,
  investigateAndSummarize,
} from "@/lib/ai/subagent/dispatcher";

const mockFetch = vi.fn();

describe("dispatcher", () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("AI_TIMEOUT_MS", "30000");
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  function createMockResponse(data: object) {
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
        },
      }),
    };
  }

  describe("dispatchSubAgent", () => {
    it("正常系: データと usage を返す", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ result: "success" }),
      );

      const result = await dispatchSubAgent({
        task: {
          role: "investigator",
          instruction: "find info",
          context: {},
        },
        weight: "light",
        outputSchema: z.object({ result: z.string() }),
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ result: "success" });
        expect(result.usage.promptTokens).toBe(10);
        expect(result.usage.totalTokens).toBe(15);
      }
    });

    it("異常系: callAi 失敗時に ok: false を返す", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "error",
      });

      const result = await dispatchSubAgent({
        task: {
          role: "investigator",
          instruction: "find info",
          context: {},
        },
        weight: "light",
        outputSchema: z.object({ result: z.string() }),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("AI provider call failed");
      }
    });
  });

  describe("runInvestigator", () => {
    it("正常系: InvestigationOutput を返す", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          missingInfo: ["a"],
          relevantContext: ["b"],
          suggestedQueries: ["c"],
        }),
      );

      const result = await runInvestigator("test instruction", { foo: "bar" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.missingInfo).toEqual(["a"]);
        expect(result.data.relevantContext).toEqual(["b"]);
        expect(result.data.suggestedQueries).toEqual(["c"]);
      }
    });

    it("異常系: エラー時に ok: false を返す", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "error",
      });

      const result = await runInvestigator("test instruction", {});
      expect(result.ok).toBe(false);
    });
  });

  describe("runSummarizer", () => {
    it("正常系: SummaryOutput を返す", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          summary: "summary text",
          keyFacts: ["fact1"],
          gapsRemaining: ["gap1"],
        }),
      );

      const result = await runSummarizer({
        missingInfo: [],
        relevantContext: [],
        suggestedQueries: [],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.summary).toBe("summary text");
        expect(result.data.keyFacts).toEqual(["fact1"]);
      }
    });

    it("異常系: エラー時に ok: false を返す", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "error",
      });

      const result = await runSummarizer({
        missingInfo: [],
        relevantContext: [],
        suggestedQueries: [],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("investigateAndSummarize", () => {
    it("正常系: investigation と summary を結合して返す", async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            missingInfo: ["a"],
            relevantContext: ["b"],
            suggestedQueries: ["c"],
          }),
        )
        .mockResolvedValueOnce(
          createMockResponse({
            summary: "summary text",
            keyFacts: ["fact1"],
            gapsRemaining: ["gap1"],
          }),
        );

      const result = await investigateAndSummarize("instruction", {
        foo: "bar",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.investigation.missingInfo).toEqual(["a"]);
        expect(result.data.summary.summary).toBe("summary text");
        expect(result.usage.promptTokens).toBe(20);
        expect(result.usage.totalTokens).toBe(30);
      }
    });

    it("investigation 失敗時に ok: false を返す", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "error",
      });

      const result = await investigateAndSummarize("instruction", {});
      expect(result.ok).toBe(false);
    });

    it("summarizer 失敗時に ok: false を返す", async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            missingInfo: ["a"],
            relevantContext: ["b"],
            suggestedQueries: ["c"],
          }),
        )
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => "error",
        });

      const result = await investigateAndSummarize("instruction", {});
      expect(result.ok).toBe(false);
    });
  });
});
