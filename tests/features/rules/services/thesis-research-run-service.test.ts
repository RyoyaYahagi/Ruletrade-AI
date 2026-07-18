import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("thesis research run service", () => {
  const originalDatabasePath = process.env.SQLITE_DATABASE_PATH;
  let tempDir: string;
  let service: typeof import("@/features/rules/services/thesis-research-run-service");

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-thesis-run-"));
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    service = await import("@/features/rules/services/thesis-research-run-service");
  });

  afterEach(() => {
    process.env.SQLITE_DATABASE_PATH = originalDatabasePath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("同じ入力の有効期限内キャッシュを所有者付きで返す", async () => {
    const inputHash = service.createThesisResearchInputHash({ ticker: "7203", answers: [] });
    const source = {
      ref: "S1",
      sourceType: "news" as const,
      url: "https://example.com/news",
      title: "ニュース",
      publisher: "RSS",
      publishedAt: "2026-07-18",
      retrievedAt: "2026-07-18T00:00:00.000Z",
      excerpt: "事業の成長",
      highlightText: "事業の成長",
      verified: true,
    };
    const draft = {
      thesis: "私は受注の伸びを観測する。",
      thesisSegments: [{ text: "受注の伸び", sourceRefs: ["S1"] }],
      evidence: [{ sourceRef: "S1", quote: "事業の成長", reason: "成長確認" }],
      growthDefinition: "受注が増えること。",
      growthIndicators: ["受注"],
      nearTermFactors: ["決算"],
      invalidationConditions: ["受注減少"],
      breakers: [
        { description: "1", newsKeywords: [], sourceRefs: ["S1"] },
        { description: "2", newsKeywords: [], sourceRefs: ["S1"] },
        { description: "3", newsKeywords: [], sourceRefs: ["S1"] },
        { description: "4", newsKeywords: [], sourceRefs: ["S1"] },
      ],
    };

    await service.saveThesisResearchRun({
      userId: "user-a",
      sessionId: "session-a",
      inputHash,
      status: "completed",
      sources: [source],
      research: { errors: [] },
      draft,
    });

    const cached = await service.getCachedThesisResearchRun({
      userId: "user-a",
      sessionId: "session-a",
      inputHash,
    });
    expect(cached?.status).toBe("completed");
    expect(service.parseCachedSources(cached?.sources_json)).toEqual([source]);
    expect(service.parseCachedDraft(cached?.draft_json)?.thesis).toBe(
      "私は受注の伸びを観測する。",
    );

    await expect(
      service.getCachedThesisResearchRun({
        userId: "user-b",
        sessionId: "session-a",
        inputHash,
      }),
    ).resolves.toBeNull();
  });

  it("期限切れキャッシュは返さない", async () => {
    const inputHash = service.createThesisResearchInputHash("expired");
    await service.saveThesisResearchRun({
      userId: "user-a",
      sessionId: "session-a",
      inputHash,
      status: "failed",
      sources: [],
      research: { errors: ["取得失敗"] },
      expiresAt: "2020-01-01T00:00:00.000Z",
    });

    await expect(
      service.getCachedThesisResearchRun({
        userId: "user-a",
        sessionId: "session-a",
        inputHash,
      }),
    ).resolves.toBeNull();
  });
});
