import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import { extractDecision, transcribeAudio } from "@/lib/ai/gemini";

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

  it("uses the fixed stock when the original thought omits its name", async () => {
    const stock = { name: "架空固定社", ticker: "1234", market: "JP" };
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        type: "buy",
        stock: { name: null, ticker: null, market: null },
        thesis: "需要を期待",
        assumptions: [],
        reviewConditions: [],
        addConditions: [],
        transaction: null,
        followUpQuestion: null,
      }),
    });
    const rawInput = "需要を期待して購入した。";
    const result = await extractDecision({ rawInput, stock });
    expect(result.stock).toEqual(stock);
    expect(generateContent.mock.calls[0][0].contents).toContain(
      JSON.stringify(stock),
    );
    expect(generateContent.mock.calls[0][0].contents).toContain(rawInput);
    expect(generateContent.mock.calls[0][0].contents).toContain(
      "銘柄名を再質問しない",
    );
  });

  it("fails on malformed model output", async () => {
    generateContent.mockResolvedValue({ text: "not-json" });
    await expect(
      extractDecision({ rawInput: "ソニーを買った。" }),
    ).rejects.toThrow();
  });

  it("fails explicitly when Gemini returns an empty response", async () => {
    generateContent.mockResolvedValue({ text: "" });
    await expect(
      extractDecision({ rawInput: "ソニーを買った。" }),
    ).rejects.toThrow("Gemini returned an empty response");
  });
});

describe("transcribeAudio", () => {
  const fetchMock = vi.fn();
  const input = { bytes: new Uint8Array([1, 2, 3]), mimeType: "audio/webm" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends audio directly and preserves negation and spoken corrections", async () => {
    const transcript = "トヨタを100株、いや200株。今は買いません。";
    fetchMock.mockResolvedValue(
      Response.json({
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: transcript }],
          },
        ],
      }),
    );

    expect(await transcribeAudio(input)).toBe(transcript);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
    );
    expect(request.method).toBe("POST");
    expect(request.headers["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(request.body)).toEqual({
      model: "gemini-3.5-transcribe",
      input: [{ type: "audio", data: "AQID", mime_type: "audio/webm" }],
      generation_config: {
        transcription_config: { language_codes: ["ja-JP"], mode: "verbatim" },
      },
      store: false,
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("maps browser MP4 audio to the supported M4A MIME type", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        status: "completed",
        steps: [
          { type: "model_output", content: [{ type: "text", text: "原文" }] },
        ],
      }),
    );
    await transcribeAudio({ ...input, mimeType: "audio/mp4" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input[0].mime_type).toBe(
      "audio/m4a",
    );
  });

  it("fails before sending empty audio or a request without an API key", async () => {
    await expect(
      transcribeAudio({ ...input, bytes: new Uint8Array() }),
    ).rejects.toThrow("Audio file is empty");
    vi.stubEnv("GEMINI_API_KEY", undefined);
    await expect(transcribeAudio(input)).rejects.toThrow(
      "GEMINI_API_KEY is required",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects API failures without exposing their response body", async () => {
    fetchMock.mockResolvedValue(
      new Response("private provider error", { status: 429 }),
    );
    await expect(transcribeAudio(input)).rejects.toThrow(
      "Gemini transcription failed (429)",
    );
  });

  it.each([
    {
      status: "completed",
      steps: [{ type: "model_output", content: [{ type: "text", text: 123 }] }],
    },
    { status: "in_progress", steps: [] },
    { unexpected: "response" },
  ])("rejects malformed or incomplete output: %j", async (response) => {
    fetchMock.mockResolvedValue(Response.json(response));
    await expect(transcribeAudio(input)).rejects.toThrow();
  });

  it("fails when the response has no nonempty transcription", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        status: "completed",
        steps: [
          { type: "model_output", content: [{ type: "text", text: "  " }] },
        ],
      }),
    );
    await expect(transcribeAudio(input)).rejects.toThrow(
      "Gemini returned an empty transcript",
    );
  });
});
