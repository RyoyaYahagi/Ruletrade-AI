import "server-only";

import { createHash } from "node:crypto";
import { createDatabaseClient } from "@/lib/db/database-client";
import { getNewsProvider } from "@/lib/news/news-provider-factory";
import { matchNewsToTickers, type TickerCandidate } from "@/lib/news/news-ticker-matcher";

export const MAX_NEWS_ITEMS_PER_RUN = 200;

function contentHash(title: string, url: string) {
  return createHash("sha256").update(`${title}${url}`).digest("hex");
}

async function getTickerCandidates() {
  const db = await createDatabaseClient();
  const [positionsResult, watchlistResult] = await Promise.all([
    db
      .from("portfolio_positions")
      .select("ticker, company_name, market")
      .neq("position_status", "archived")
      .limit(5000),
    db
      .from("watchlist_items")
      .select("ticker, company_name, market")
      .neq("status", "archived")
      .limit(5000),
  ]);
  if (positionsResult.error || watchlistResult.error) {
    throw positionsResult.error ?? watchlistResult.error;
  }

  const candidates = new Map<string, TickerCandidate>();
  for (const row of [...(positionsResult.data ?? []), ...(watchlistResult.data ?? [])]) {
    const symbol = String(row.ticker ?? "").trim();
    if (!symbol) continue;
    const key = `${row.market ?? "JP"}:${symbol}`;
    candidates.set(key, {
      symbol,
      companyName: row.company_name ? String(row.company_name) : null,
      market: row.market ? String(row.market) : "JP",
    });
  }
  return [...candidates.values()];
}

export async function fetchAndMatchRecentNews(params?: { sinceHours?: number }) {
  const provider = getNewsProvider();
  const articles = (await provider.fetchRecentNews({ sinceHours: params?.sinceHours ?? 26 })).slice(
    0,
    MAX_NEWS_ITEMS_PER_RUN,
  );
  const candidates = await getTickerCandidates();
  const db = await createDatabaseClient();

  let newCount = 0;
  let matchedCount = 0;
  for (const article of articles) {
    const hash = contentHash(article.title, article.url);
    const { data: existing, error: findError } = await db
      .from("news_items")
      .select("id")
      .eq("content_hash", hash)
      .maybeSingle();
    if (findError) throw findError;

    let newsItemId = existing?.id as string | undefined;
    if (!newsItemId) {
      const { data, error } = await db
        .from("news_items")
        .insert({
          source: provider.name,
          external_id: article.externalId,
          title: article.title,
          summary: article.summary,
          url: article.url,
          published_at: article.publishedAt,
          content_hash: hash,
        })
        .select("id")
        .single();
      if (error) {
        if (/unique|constraint/i.test(error.message)) continue;
        throw error;
      }
      newsItemId = data?.id as string | undefined;
      newCount += 1;
    }
    if (!newsItemId) continue;

    const matches = matchNewsToTickers({
      text: `${article.title}\n${article.summary ?? ""}`,
      candidates,
    });
    for (const match of matches) {
      const { data: existingMatch, error: matchFindError } = await db
        .from("news_ticker_matches")
        .select("id")
        .eq("news_item_id", newsItemId)
        .eq("symbol", match.symbol)
        .eq("market", match.market ?? "JP")
        .maybeSingle();
      if (matchFindError) throw matchFindError;
      if (existingMatch) continue;

      const { error: matchError } = await db.from("news_ticker_matches").insert({
        news_item_id: newsItemId,
        symbol: match.symbol,
        market: match.market ?? "JP",
        match_method: match.matchMethod,
      });
      if (matchError) throw matchError;
      matchedCount += 1;
    }
  }

  return {
    fetchedCount: articles.length,
    newCount,
    matchedCount,
    provider: provider.name,
  };
}

export { contentHash };
