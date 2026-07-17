import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("knowledge article service", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    for (const tempDir of tempDirs.splice(0)) fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it("権利処理の記録がない記事を拒否する", async () => {
    const service = await loadService();
    await expect(
      service.createKnowledgeArticle({
        title: "記事",
        body: "本文",
        topicKeys: ["holding_purpose"],
        authorName: "著者",
        licenseNote: "",
        isActive: true,
      }),
    ).rejects.toThrow();
  });

  it("有効記事だけを完全一致のtopic keyで返す", async () => {
    const service = await loadService();
    const common = {
      body: "一般的な説明",
      authorName: "著者",
      sourceName: "書籍",
      publishedAt: "2026-07-01",
      licenseNote: "自社作成",
      isActive: true,
    };
    await service.createKnowledgeArticle({
      ...common,
      title: "一致",
      topicKeys: ["holding_purpose"],
    });
    await service.createKnowledgeArticle({
      ...common,
      title: "部分一致ではない",
      topicKeys: ["holding_purpose_extra"],
    });
    await service.createKnowledgeArticle({
      ...common,
      title: "無効",
      topicKeys: ["holding_purpose"],
      isActive: false,
    });

    await expect(
      service.listActiveArticlesByTopic("holding_purpose"),
    ).resolves.toMatchObject({ articles: [{ title: "一致" }] });
  });

  async function loadService() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-knowledge-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    return import("@/features/knowledge/services/knowledge-article-service");
  }
});
