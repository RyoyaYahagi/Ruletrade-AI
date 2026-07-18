import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("thesis research search service", () => {
  const originalKey = process.env.THESIS_SEARCH_API_KEY;
  const originalUrl = process.env.THESIS_SEARCH_API_URL;
  let service: typeof import("@/features/rules/services/thesis-research-search-service");

  beforeEach(async () => {
    process.env.THESIS_SEARCH_API_KEY = undefined;
    process.env.THESIS_SEARCH_API_URL = undefined;
    vi.resetModules();
    service = await import("@/features/rules/services/thesis-research-search-service");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.THESIS_SEARCH_API_KEY = originalKey;
    process.env.THESIS_SEARCH_API_URL = originalUrl;
    vi.resetModules();
  });

  it("APIキーがない場合は検索を実行しない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      service.searchThesisResearchSources({ ticker: "7203", companyName: "A社" }),
    ).resolves.toEqual({ sources: [], errors: [] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(service.getThesisSearchSourceVersion()).toBe("disabled");
  });

  it("有効な公開URLだけを検索ソースとして返す", async () => {
    process.env.THESIS_SEARCH_API_KEY = "secret-for-test";
    process.env.THESIS_SEARCH_API_URL = "https://search.example.test/search";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: "A社 IRニュース",
              url: "https://example.com/news/a",
              content: "受注の増加と設備投資の進捗を確認する。",
              publisher: "A社",
              published_date: "2026-07-17",
            },
            {
              title: "ローカルURL",
              url: "https://localhost/private",
              content: "この内容は除外する。",
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await service.searchThesisResearchSources({
      ticker: "7203",
      companyName: "A社",
    });

    expect(result.errors).toEqual([]);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      content: "受注の増加と設備投資の進捗を確認する。",
      source: {
        sourceType: "search",
        url: "https://example.com/news/a",
        verified: false,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://search.example.test/search",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("secret-for-test"),
      }),
    );
  });

  it("検索APIの失敗を明示的なエラーとして返す", async () => {
    process.env.THESIS_SEARCH_API_KEY = "test-search-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
    );

    await expect(
      service.searchThesisResearchSources({ ticker: "7203" }),
    ).resolves.toMatchObject({
      sources: [],
      errors: ["検索APIの取得に失敗しました: HTTP 503"],
    });
  });
});
