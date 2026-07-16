import { env } from "@/env";
import type { NewsArticle, NewsProvider } from "@/lib/news/news-provider";

const ITEM_PATTERN = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

function readTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ? decodeXml(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()) : null;
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export class RssNewsProvider implements NewsProvider {
  readonly name = "rss";

  async fetchRecentNews(params: { sinceHours: number }): Promise<NewsArticle[]> {
    const feeds = env.NEWS_RSS_FEEDS.split(",").map((feed) => feed.trim()).filter(Boolean);
    const since = Date.now() - params.sinceHours * 60 * 60 * 1000;
    const articles: NewsArticle[] = [];

    for (const feed of feeds) {
      const response = await fetch(feed, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`RSS fetch failed: ${response.status} ${feed}`);
      const xml = await response.text();
      for (const item of xml.matchAll(ITEM_PATTERN)) {
        const body = item[1];
        const title = readTag(body, "title");
        const url = readTag(body, "link") ?? readTag(body, "guid");
        const publishedAt = readTag(body, "pubDate") ?? readTag(body, "dc:date");
        if (!title || !url || !publishedAt) continue;
        const parsedDate = Date.parse(publishedAt);
        if (!Number.isFinite(parsedDate) || parsedDate < since) continue;
        articles.push({
          externalId: url,
          title,
          summary: readTag(body, "description"),
          url,
          publishedAt: new Date(parsedDate).toISOString(),
          sourceName: new URL(feed).hostname,
        });
      }
    }

    return articles;
  }
}
