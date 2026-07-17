import { env } from "@/env";
import type { NewsProvider } from "@/lib/news/news-provider";
import { MockNewsProvider } from "@/lib/news/providers/mock-news-provider";
import { RssNewsProvider } from "@/lib/news/providers/rss-news-provider";

export function getNewsProvider(): NewsProvider {
  if (env.NEWS_PROVIDER === "rss") return new RssNewsProvider();
  return new MockNewsProvider();
}
