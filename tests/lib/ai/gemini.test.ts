import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import { extractDecision } from "@/lib/ai/gemini";

describe("extractDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-3.8-flash";
  });

  it("keeps follow-up answers separate and prevents asking a second question", async () => {
    const extraction = {
      type: "buy",
      stock: { ticker: null, name: "キオクシア", market: null },
      thesis: "AI向け需要を期待",
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      transaction: null,
      followUpQuestion: "もう一つ質問しますか？",
    };
    generateContent.mockResolvedValue({ text: JSON.stringify(extraction) });
    const rawInput = "キオクシアを買った。AI向け需要を期待。";
    const followUpAnswer = "需要が鈍化したとき。";

    const result = await extractDecision({ rawInput, followUpAnswer });

    expect(result.followUpQuestion).toBeNull();
    const prompt = generateContent.mock.calls[0]?.[0].contents as string;
    expect(prompt).toContain(rawInput);
    expect(prompt).toContain(followUpAnswer);
    expect(prompt).toContain("followUpQuestionは必ずnull");
    expect(generateContent.mock.calls[0]?.[0].model).toBe("gemini-3.8-flash");
  });

  it("fails on malformed model output", async () => {
    generateContent.mockResolvedValue({ text: "not-json" });
    await expect(extractDecision({ rawInput: "ソニーを買った。" })).rejects.toThrow();
  });

  it("fails explicitly when Gemini returns an empty response", async () => {
    generateContent.mockResolvedValue({ text: "" });
    await expect(extractDecision({ rawInput: "ソニーを買った。" })).rejects.toThrow(
      "Gemini returned an empty response",
    );
  });
});
