import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_DISCLAIMER,
  formatKnowledgeArticleCitation,
} from "@/features/knowledge/components/knowledge-article-links";

describe("knowledge article citation", () => {
  it("著者・出典・公開日と免責文を表示できる", () => {
    expect(
      formatKnowledgeArticleCitation({
        authorName: "山田太郎",
        sourceName: "投資の基本",
        publishedAt: "2026-07-01",
      }),
    ).toContain("山田太郎");
    expect(KNOWLEDGE_DISCLAIMER).toContain("特定の銘柄の売買を勧めるものではありません");
  });
});
