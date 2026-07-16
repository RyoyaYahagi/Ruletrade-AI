import type { NewsArticle, NewsProvider } from "@/lib/news/news-provider";

export class MockNewsProvider implements NewsProvider {
  readonly name = "mock";

  async fetchRecentNews(params: { sinceHours: number }): Promise<NewsArticle[]> {
    const publishedAt = new Date(Date.now() - Math.min(params.sinceHours, 2) * 60 * 60 * 1000).toISOString();
    return [
      {
        externalId: "mock-7203-earnings",
        title: "7203 トヨタ自動車の決算資料が公開されました",
        summary: "決算に関する適時開示のサンプルです。",
        url: "https://example.com/news/7203-earnings",
        publishedAt,
        sourceName: "Mock News",
      },
      {
        externalId: "mock-market-general",
        title: "市場全体に関する一般ニュース",
        summary: "銘柄コードを含まない記事のサンプルです。",
        url: "https://example.com/news/market-general",
        publishedAt,
        sourceName: "Mock News",
      },
    ];
  }
}
