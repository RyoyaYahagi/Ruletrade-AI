import "server-only";

import { isPublicHttpsUrl } from "@/features/rules/services/thesis-research-url-service";
import type { ThesisResearchSource } from "@/schemas/rules/thesis-research-schema";

const DEFAULT_SEARCH_API_URL = "https://api.tavily.com/search";
const SEARCH_TIMEOUT_MS = 12_000;
const MAX_SEARCH_RESULTS = 5;
const MAX_SEARCH_CONTENT_CHARS = 6_000;

type SearchResult = {
  title: string;
  url: string;
  content: string;
  publishedAt: string | null;
  publisher: string;
};

export type ThesisSearchCollection = {
  sources: Array<{ source: ThesisResearchSource; content: string }>;
  errors: string[];
};

export function getThesisSearchSourceVersion() {
  const apiKey = process.env.THESIS_SEARCH_API_KEY?.trim();
  if (!apiKey || apiKey === "undefined") return "disabled";
  return process.env.THESIS_SEARCH_API_URL?.trim() || DEFAULT_SEARCH_API_URL;
}

export async function searchThesisResearchSources(params: {
  ticker: string;
  companyName?: string | null;
}): Promise<ThesisSearchCollection> {
  const apiKey = process.env.THESIS_SEARCH_API_KEY?.trim();
  if (!apiKey || apiKey === "undefined") return { sources: [], errors: [] };

  const endpoint = process.env.THESIS_SEARCH_API_URL?.trim() || DEFAULT_SEARCH_API_URL;
  const query = `${params.companyName ?? params.ticker} ${params.ticker} 事業 成長 受注 決算 IR`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        topic: "general",
        max_results: MAX_SEARCH_RESULTS,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        sources: [],
        errors: [`検索APIの取得に失敗しました: HTTP ${response.status}`],
      };
    }

    const payload = (await response.json()) as { results?: unknown };
    if (!Array.isArray(payload.results)) {
      return { sources: [], errors: ["検索APIの結果形式を確認できませんでした。"] };
    }

    const results = payload.results
      .map(parseSearchResult)
      .filter((result): result is SearchResult => result !== null);
    if (payload.results.length > 0 && results.length === 0) {
      return {
        sources: [],
        errors: ["検索APIの結果に有効な公開ソースがありません。"],
      };
    }
    return {
      sources: results.map((result, index) => ({
        content: result.content,
        source: {
          ref: `SEARCH${index + 1}`,
          sourceType: "search",
          url: result.url,
          title: result.title,
          publisher: result.publisher,
          publishedAt: result.publishedAt,
          retrievedAt: new Date().toISOString(),
          excerpt: result.content.slice(0, 1_500),
          highlightText: result.content.slice(0, 600),
          verified: false,
        },
      })),
      errors: [],
    };
  } catch (error) {
    return {
      sources: [],
      errors: [
        `検索APIに接続できませんでした: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

function parseSearchResult(value: unknown): SearchResult | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const url = typeof row.url === "string" ? row.url.trim() : "";
  const content = typeof row.content === "string" ? row.content.trim() : "";
  if (!title || !content || !isPublicHttpsUrl(url)) return null;

  const publisher =
    typeof row.publisher === "string" && row.publisher.trim()
      ? row.publisher.trim()
      : new URL(url).hostname;
  const publishedAt =
    typeof row.published_date === "string"
      ? row.published_date
      : typeof row.publishedAt === "string"
        ? row.publishedAt
        : null;
  return {
    title: title.slice(0, 300),
    url,
    content: content.slice(0, MAX_SEARCH_CONTENT_CHARS),
    publishedAt,
    publisher: publisher.slice(0, 200),
  };
}
