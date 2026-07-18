import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("thesis research source service", () => {
  const originalDatabasePath = process.env.SQLITE_DATABASE_PATH;
  const originalSearchApiKey = process.env.THESIS_SEARCH_API_KEY;
  const originalSearchApiUrl = process.env.THESIS_SEARCH_API_URL;
  let tempDir: string;
  let service: typeof import("@/features/rules/services/thesis-research-source-service");
  let db: import("@/lib/db/sqlite-client").SqliteDatabaseClient;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-thesis-source-"));
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    vi.resetModules();
    service = await import("@/features/rules/services/thesis-research-source-service");
    const databaseModule = await import("@/lib/db/sqlite-client");
    db = databaseModule.createSqliteClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.SQLITE_DATABASE_PATH = originalDatabasePath;
    process.env.THESIS_SEARCH_API_KEY = originalSearchApiKey;
    process.env.THESIS_SEARCH_API_URL = originalSearchApiUrl;
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("公開HTTPS以外のソースURLを拒否する", () => {
    expect(() => service.assertPublicHttpsUrl("http://example.com/ir")).toThrow();
    expect(() => service.assertPublicHttpsUrl("https://localhost/ir")).toThrow();
    expect(() => service.assertPublicHttpsUrl("https://127.0.0.1/ir")).toThrow();
    expect(() => service.assertPublicHttpsUrl("https://user:pass@example.com/ir")).toThrow();
    expect(() => service.assertPublicHttpsUrl("https://example.com/ir")).not.toThrow();
  });

  it("登録済み企業IRを取得し、所有者付きで更新する", async () => {
    const source = await service.addThesisResearchSource({
      userId: "user-a",
      input: {
        ticker: "7203",
        market: "JP",
        sourceType: "company_ir",
        url: "https://example.com/ir",
        title: "A社 決算説明資料",
        publisher: "A社",
        publishedAt: "2026-07-10",
      },
    });
    await service.addThesisResearchSource({
      userId: "user-b",
      input: {
        ticker: "7203",
        market: "JP",
        sourceType: "company_ir",
        url: "https://example.com/other-ir",
        title: "別ユーザー資料",
        publisher: "A社",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        `
          <html>
            <head><title>A社 IR</title></head>
            <body>
              <header>ヘッダーの一般案内</header>
              <nav>トップページ / 会社情報</nav>
              <article>
                <h1>決算説明資料</h1>
                <p>A社の主力事業は受注と売上の拡大を目指しています。</p>
                <h2>今後の確認事項</h2>
                <p>設備稼働も確認します。</p>
              </article>
              <script>window.unwanted = true;</script>
              <footer>フッターの一般案内</footer>
            </body>
          </html>
        `,
        { headers: { "content-type": "text/html" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await service.collectThesisResearchSources({
      userId: "user-a",
      ticker: "7203",
      market: "JP",
    });

    expect(result.errors).toEqual([]);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].source).toMatchObject({
      ref: "S1",
      title: "A社 決算説明資料",
      publishedAt: "2026-07-10",
      verified: false,
    });
    expect(result.sources[0].content).toContain(
      "A社の主力事業は受注と売上の拡大を目指しています。",
    );
    expect(result.sources[0].content).toContain("## 今後の確認事項");
    expect(result.sources[0].content).not.toContain("トップページ");
    expect(result.sources[0].content).not.toContain("window.unwanted");
    expect(result.sources[0].content).not.toContain("フッターの一般案内");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/ir",
      expect.objectContaining({ redirect: "error" }),
    );
    const stored = await db
      .from("thesis_research_sources")
      .select("last_fetched_at")
      .eq("id", source.id)
      .eq("user_id", "user-a")
      .single();
    expect(stored.data?.last_fetched_at).toEqual(expect.any(String));

    const otherUserSources = await service.listThesisResearchSources({
      userId: "user-b",
      ticker: "7203",
      market: "JP",
    });
    expect(otherUserSources).toHaveLength(1);
    expect(otherUserSources[0].title).toBe("別ユーザー資料");
  });

  it("ニュース、ユーザー資料、財務数値を既存DBから調査ソースに変換する", async () => {
    await db.from("news_items").insert({
      id: "news-1",
      source: "RSS",
      external_id: "news-1",
      title: "A社の受注拡大",
      summary: "事業の成長と受注の拡大が発表された。",
      url: "https://example.com/news-1",
      published_at: "2026-07-18T00:00:00.000Z",
      content_hash: "hash-news-1",
    });
    await db.from("news_ticker_matches").insert({
      id: "match-1",
      news_item_id: "news-1",
      symbol: "7203",
      market: "JP",
      match_method: "ticker_code",
    });
    await db.from("user_documents").insert({
      id: "document-1",
      user_id: "user-a",
      title: "調査メモ",
      document_type: "note",
      document_kind: "note",
      ticker: "7203",
      extracted_text: "顧客数と受注残の増加を確認する。",
      source_url: "https://example.com/memo",
    });
    await db.from("financial_statements").insert({
      id: "financial-1",
      ticker: "7203",
      market: "JP",
      fiscal_period: "FY2026Q1",
      revenue: 1000,
      operating_income: 120,
      net_income: 80,
      eps: 10,
      equity_ratio: 40,
      currency: "JPY",
      source: "manual",
      filed_at: "2026-07-01",
    });

    const result = await service.collectThesisResearchSources({
      userId: "user-a",
      ticker: "7203",
      market: "JP",
    });

    expect(result.errors).toEqual([]);
    expect(result.sources.map((item) => item.source.sourceType)).toEqual([
      "news",
      "user_document",
      "financial_statement",
    ]);
    expect(result.sources.map((item) => item.source.ref)).toEqual(["S1", "S2", "S3"]);
    expect(result.sources[2].content).toContain("売上: 1,000 JPY");
  });

  it("取得に失敗した登録ソースを一般論に置き換えずエラーとして返す", async () => {
    await service.addThesisResearchSource({
      userId: "user-a",
      input: {
        ticker: "7203",
        market: "JP",
        sourceType: "primary",
        url: "https://example.com/unavailable",
        title: "取得不能資料",
        publisher: "A社",
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const result = await service.collectThesisResearchSources({
      userId: "user-a",
      ticker: "7203",
      market: "JP",
    });

    expect(result.sources).toEqual([]);
    expect(result.errors).toEqual(["取得不能資料: network error"]);
  });

  it("既存ソースがない場合だけ、設定済み検索APIの結果を調査ソースにする", async () => {
    process.env.THESIS_SEARCH_API_KEY = "test-search-key";
    process.env.THESIS_SEARCH_API_URL = "https://search.example.test/search";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                title: "A社の事業成長",
                url: "https://example.com/research/a",
                content: "受注残と顧客数の増加が事業成長の確認材料になる。",
                published_date: "2026-07-17",
              },
              {
                title: "内部URL",
                url: "https://127.0.0.1/private",
                content: "表示してはいけない内容",
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await service.collectThesisResearchSources({
      userId: "user-a",
      ticker: "7203",
      companyName: "A社",
      market: "JP",
    });

    expect(result.errors).toEqual([]);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].source).toMatchObject({
      ref: "S1",
      sourceType: "search",
      title: "A社の事業成長",
      publishedAt: "2026-07-17",
      verified: false,
    });
  });
});
