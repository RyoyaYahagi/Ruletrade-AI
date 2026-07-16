export type NewsArticle = {
  externalId: string;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string;
  sourceName: string;
};

export interface NewsProvider {
  readonly name: string;
  fetchRecentNews(params: { sinceHours: number }): Promise<NewsArticle[]>;
}
