import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
  importJson: vi.fn(),
  getDb: vi.fn(),
  extractDecision: vi.fn(),
  compareDecision: vi.fn(),
  transcribeAudio: vi.fn(),
  previewCsv: vi.fn(),
  importCsv: vi.fn(),
  undoImport: vi.fn(),
  classifyFeedback: vi.fn(),
  createFeedbackIssue: vi.fn(),
}));
vi.mock("@/features/json-import/service", () => ({
  importJson: services.importJson,
  JsonImportError: class extends Error {},
}));
vi.mock("@/lib/db", () => ({ getDb: services.getDb }));
vi.mock("@/lib/ai/gemini", () => services);
vi.mock("@/features/csv-import/service", () => services);
vi.mock("@/lib/feedback/classify", () => services);
vi.mock("@/lib/feedback/github", () => services);

import { POST as jsonImport } from "@/app/api/import/json/route";
import { POST as extract } from "@/app/api/decisions/extract/route";
import { POST as compare } from "@/app/api/reviews/compare/route";
import { POST as transcribe } from "@/app/api/decisions/transcribe/route";
import { POST as csvImport } from "@/app/api/import/route";
import { POST as feedback } from "@/app/api/feedback/route";

beforeEach(() => vi.resetAllMocks());

const routes = [
  ["/api/import/json", jsonImport],
  ["/api/decisions/extract", extract],
  ["/api/reviews/compare", compare],
  ["/api/decisions/transcribe", transcribe],
  ["/api/import", csvImport],
  ["/api/feedback", feedback],
] as const;

const attacks: [string, Record<string, string>][] = [
  ["foreign origin", { origin: "https://evil.example" }],
  [
    "same-site sibling",
    { origin: "https://other.journal.example", "sec-fetch-site": "same-site" },
  ],
  ["different port", { origin: "https://journal.example:9444" }],
  ["opaque origin", { origin: "null" }],
  ["non-HTTP origin", { origin: "ftp://journal.example:9445" }],
  ["malformed origin", { origin: "https://journal.example:9445/path" }],
  ["cross-site without Origin", { "sec-fetch-site": "cross-site" }],
  [
    "cross-site despite matching Origin",
    { origin: "https://journal.example:9445", "sec-fetch-site": "cross-site" },
  ],
];

describe.each(routes)("%s browser write boundary", (path, post) => {
  it.each(attacks)(
    "rejects %s before reading input or using services",
    async (_, attackHeaders) => {
      const request = new Request(`http://127.0.0.1:3001${path}`, {
        method: "POST",
        headers: {
          host: "journal.example:9445",
          "x-forwarded-host": "journal.example:9445, proxy.internal",
          "content-type": "text/plain",
          ...attackHeaders,
        },
        body: JSON.stringify({
          rawInput: "外部サイトの入力",
          currentInput: "考え",
          stockId: "stock-1",
        }),
      });
      expect((await post(request)).status).toBe(403);
      expect(request.bodyUsed).toBe(false);
      for (const service of Object.values(services))
        expect(service).not.toHaveBeenCalled();
    },
  );
});

it("imports a same-origin JSON backup behind the HTTPS proxy", async () => {
  services.importJson.mockReturnValue({ importedCount: 1, skippedCount: 0 });
  const response = await jsonImport(
    new Request("http://127.0.0.1:3001/api/import/json", {
      method: "POST",
      headers: {
        origin: "https://journal.example:9445",
        host: "127.0.0.1:3001",
        "x-forwarded-host": "journal.example:9445",
        "sec-fetch-site": "same-origin",
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ formatVersion: 4 }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ importedCount: 1, skippedCount: 0 });
  expect(services.importJson).toHaveBeenCalledWith({ formatVersion: 4 });
});

it.each([
  ["/api/import/json", jsonImport],
  ["/api/decisions/extract", extract],
  ["/api/reviews/compare", compare],
] as const)(
  "rejects a simple text/plain JSON submission to %s",
  async (path, post) => {
    const request = new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    expect((await post(request)).status).toBe(415);
    expect(request.bodyUsed).toBe(false);
    for (const service of Object.values(services))
      expect(service).not.toHaveBeenCalled();
  },
);

it("rejects a cross-site multipart audio upload before transcription", async () => {
  const form = new FormData();
  form.append(
    "audio",
    new File([new Uint8Array([1, 2, 3])], "voice.webm", { type: "audio/webm" }),
  );
  const request = new Request("http://localhost/api/decisions/transcribe", {
    method: "POST",
    headers: { origin: "https://evil.example" },
    body: form,
  });
  expect((await transcribe(request)).status).toBe(403);
  expect(request.bodyUsed).toBe(false);
  expect(services.transcribeAudio).not.toHaveBeenCalled();
});
