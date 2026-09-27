import { beforeEach, describe, expect, it, vi } from "vitest";

const { extractDecision, transcribeAudio, compareDecision, getDb } = vi.hoisted(() => ({
  extractDecision: vi.fn(),
  transcribeAudio: vi.fn(),
  compareDecision: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("@/lib/ai/gemini", () => ({ extractDecision, transcribeAudio, compareDecision }));
vi.mock("@/lib/db", () => ({ getDb }));

import { POST as extractPost } from "@/app/api/decisions/extract/route";
import { POST as transcribePost } from "@/app/api/decisions/transcribe/route";
import { POST as comparePost } from "@/app/api/reviews/compare/route";

describe("decision AI routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid extraction input before calling Gemini", async () => {
    const response = await extractPost(jsonRequest({ rawInput: "   " }));
    expect(response.status).toBe(400);
    expect(extractDecision).not.toHaveBeenCalled();
  });

  it("returns a validated extraction response", async () => {
    extractDecision.mockResolvedValue({
      type: "buy",
      stock: { ticker: null, name: "キオクシア", market: null },
      thesis: "AI向け需要を期待",
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      transaction: null,
      followUpQuestion: null,
    });
    const response = await extractPost(jsonRequest({ rawInput: "キオクシアを買った。" }));
    expect(response.status).toBe(200);
    expect((await response.json()).stock.name).toBe("キオクシア");
  });

  it("returns a safe error when extraction fails and rejects invalid comparison input", async () => {
    extractDecision.mockRejectedValue(new Error("model response invalid"));
    const failed = await extractPost(jsonRequest({ rawInput: "キオクシアを買った。" }));
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "判断内容を整理できませんでした。入力を確認して再試行してください。" });

    const invalid = await comparePost(jsonRequest({ stockId: " ", currentInput: " " }));
    expect(invalid.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("compares against the selected stock history and returns a safe error on model failure", async () => {
    let selectNumber = 0;
    getDb.mockReturnValue({
      select: () => {
        selectNumber += 1;
        if (selectNumber === 1) {
          return { from: () => ({ where: () => ({ get: () => ({
            id: "stock-1",
            ticker: "285A",
            name: "キオクシア",
            market: "JP",
            createdAt: "2026-01-01T00:00:00.000Z",
          }) }) }) };
        }
        return { from: () => ({ where: () => ({ orderBy: () => ({ all: () => [] }) }) }) };
      },
    });
    compareDecision.mockResolvedValue({
      summary: "現在の考えを過去の判断と比較しました。",
      differences: ["当初の条件ではなく、株価下落が理由として挙がっています。"],
    });
    const request = jsonRequest({ stockId: "stock-1", currentInput: "株価が下がったので売ろうか考えている。" });
    const response = await comparePost(request);
    expect(response.status).toBe(200);
    expect((await response.json()).differences).toHaveLength(1);
    expect(compareDecision).toHaveBeenCalledWith({
      currentInput: "株価が下がったので売ろうか考えている。",
      decisions: [],
    });

    compareDecision.mockRejectedValue(new Error("invalid model response"));
    const failed = await comparePost(jsonRequest({ stockId: "stock-1", currentInput: "もう一度比較する。" }));
    expect(failed.status).toBe(502);
  });

  it("rejects unsupported audio types and returns a transcription for valid audio", async () => {
    const invalid = new FormData();
    invalid.append("audio", new File(["x"], "voice.txt", { type: "text/plain" }));
    expect((await transcribePost(new Request("http://localhost/api/decisions/transcribe", { method: "POST", body: invalid }))).status).toBe(415);
    expect(transcribeAudio).not.toHaveBeenCalled();

    transcribeAudio.mockResolvedValue("キオクシアを買った。");
    const valid = new FormData();
    valid.append("audio", new File([new Uint8Array([1, 2, 3])], "voice.webm", { type: "audio/webm;codecs=opus" }));
    const response = await transcribePost(new Request("http://localhost/api/decisions/transcribe", { method: "POST", body: valid }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ transcript: "キオクシアを買った。" });
  });

  it("rejects audio above the inline request limit before calling Gemini", async () => {
    const body = new FormData();
    body.append("audio", new File([new Uint8Array(14 * 1024 * 1024 + 1)], "large.webm", { type: "audio/webm" }));
    const response = await transcribePost(new Request("http://localhost/api/decisions/transcribe", { method: "POST", body }));
    expect(response.status).toBe(400);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });
});

function jsonRequest(value: unknown) {
  return new Request("http://localhost/api/decisions/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}
