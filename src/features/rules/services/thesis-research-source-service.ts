import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { ThesisResearchSourceInputSchema } from "@/schemas/rules/thesis-research-schema";
import {
  assertPublicHttpsUrl,
} from "@/features/rules/services/thesis-research-url-service";
export { assertPublicHttpsUrl };
import {
  getThesisSearchSourceVersion,
  searchThesisResearchSources,
} from "@/features/rules/services/thesis-research-search-service";
import type {
  ThesisResearchSource,
  ThesisResearchSourceInput,
  ThesisResearchSourceType,
} from "@/schemas/rules/thesis-research-schema";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_FETCHED_TEXT_CHARS = 40_000;
const MAX_SOURCE_EXCERPT_CHARS = 1_500;
type LooseRow = Record<string, unknown>;

type SourceRow = {
  id: string;
  source_type: ThesisResearchSourceType;
  url: string | null;
  title: string;
  publisher: string;
  published_at?: string | null;
  retrieved_at?: string | null;
  excerpt: string;
  highlight_text: string;
  content: string;
};

export type CollectedThesisResearchSource = {
  source: ThesisResearchSource;
  content: string;
};

export type ResearchCollectionResult = {
  sources: CollectedThesisResearchSource[];
  errors: string[];
};

export async function listThesisResearchSources(params: {
  userId: string;
  ticker: string;
  market?: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("thesis_research_sources")
    .select("*")
    .eq("user_id", params.userId)
    .eq("ticker", params.ticker)
    .eq("market", params.market ?? "JP")
    .eq("active", 1)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addThesisResearchSource(params: {
  userId: string;
  input: ThesisResearchSourceInput;
}) {
  const parsed = ThesisResearchSourceInputSchema.safeParse(params.input);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "調査ソースの入力内容を確認してください。",
      400,
      parsed.error.flatten(),
    );
  }
  assertPublicHttpsUrl(parsed.data.url);

  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("thesis_research_sources")
    .upsert(
      {
        user_id: params.userId,
        ticker: parsed.data.ticker,
        market: parsed.data.market,
        source_type: parsed.data.sourceType,
        url: parsed.data.url,
        title: parsed.data.title,
        publisher: parsed.data.publisher,
        published_at: parsed.data.publishedAt ?? null,
        active: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,ticker,market,url" },
    )
    .select("*")
    .single();
  if (error || !data) {
    throw new AppError(
      "DATABASE_ERROR",
      "調査ソースの保存に失敗しました。",
      500,
      error,
    );
  }
  return data;
}

export async function getThesisResearchSourceVersion(params: {
  userId: string;
  ticker: string;
  market?: string;
}) {
  const db = await createDatabaseClient();
  const market = params.market ?? "JP";
  const [catalog, documents, newsMatches, statements] = await Promise.all([
    db
      .from("thesis_research_sources")
      .select("updated_at")
      .eq("user_id", params.userId)
      .eq("ticker", params.ticker)
      .eq("market", market)
      .eq("active", 1),
    db
      .from("user_documents")
      .select("uploaded_at, created_at, updated_at")
      .eq("user_id", params.userId)
      .eq("ticker", params.ticker)
      .limit(20),
    db
      .from("news_ticker_matches")
      .select("news_item_id")
      .eq("symbol", params.ticker)
      .eq("market", market)
      .limit(20),
    db
      .from("financial_statements")
      .select("filed_at, created_at")
      .eq("ticker", params.ticker)
      .eq("market", market)
      .limit(20),
  ]);
  const firstError = [catalog, documents, newsMatches, statements].find(
    (result) => result.error,
  )?.error;
  if (firstError) throw firstError;

  const newsIds = (newsMatches.data ?? [])
    .map((row: LooseRow) => String(row.news_item_id ?? ""))
    .filter(Boolean);
  const news =
    newsIds.length === 0
      ? { data: [], error: null }
      : await db
          .from("news_items")
          .select("published_at, created_at")
          .in("id", newsIds);
  if (news.error) throw news.error;

  const timestamps = [
    ...(catalog.data ?? []).map((row: LooseRow) => row.updated_at),
    ...(documents.data ?? []).flatMap((row: LooseRow) => [row.uploaded_at, row.created_at, row.updated_at]),
    ...(news.data ?? []).flatMap((row: LooseRow) => [row.published_at, row.created_at]),
    ...(statements.data ?? []).flatMap((row: LooseRow) => [row.filed_at, row.created_at]),
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => Date.parse(right) - Date.parse(left));
  return `${timestamps[0] ?? "none"}|search:${getThesisSearchSourceVersion()}`;
}

export async function collectThesisResearchSources(params: {
  userId: string;
  ticker: string;
  market?: string;
  companyName?: string | null;
}) {
  const db = await createDatabaseClient();
  const market = params.market ?? "JP";
  const [catalog, newsMatches, documents, statements] = await Promise.all([
    listThesisResearchSources(params),
    db
      .from("news_ticker_matches")
      .select("news_item_id")
      .eq("symbol", params.ticker)
      .eq("market", market)
      .limit(20),
    db
      .from("user_documents")
      .select(
        "id, title, source_url, extracted_text, document_kind, fiscal_period, uploaded_at",
      )
      .eq("user_id", params.userId)
      .eq("ticker", params.ticker)
      .limit(10),
    db
      .from("financial_statements")
      .select("*")
      .eq("ticker", params.ticker)
      .eq("market", market)
      .order("fiscal_period", { ascending: false })
      .limit(4),
  ]);

  const queryError = [newsMatches, documents, statements].find(
    (result) => result.error,
  )?.error;
  if (queryError) throw queryError;

  const sources: CollectedThesisResearchSource[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  const catalogResults = await Promise.all(
    catalog.map(async (row: LooseRow) => {
      try {
        const fetched = await fetchPublicSource(String(row.url));
        const { error: updateError } = await db
          .from("thesis_research_sources")
          .update({ last_fetched_at: now })
          .eq("id", String(row.id))
          .eq("user_id", params.userId);
        if (updateError) throw updateError;
        return {
          content: fetched.content,
          source: toPublicSource({
            id: String(row.id),
            source_type: row.source_type as ThesisResearchSourceType,
            url: normalizeExternalUrl(String(row.url)),
            title: String(row.title),
            publisher: String(row.publisher),
            published_at: row.published_at == null ? null : String(row.published_at),
            retrieved_at: now,
            excerpt: fetched.excerpt,
            highlight_text: fetched.highlightText,
            content: fetched.content,
          }),
        } satisfies CollectedThesisResearchSource;
      } catch (error) {
        return {
          error: `${row.title}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }),
  );
  for (const result of catalogResults) {
    if ("error" in result) errors.push(result.error);
    else sources.push(result);
  }

  const newsIds = (newsMatches.data ?? [])
    .map((row: LooseRow) => String(row.news_item_id ?? ""))
    .filter(Boolean);
  if (newsIds.length > 0) {
    const { data: newsItems, error: newsError } = await db
      .from("news_items")
      .select("id, title, summary, url, source, published_at")
      .in("id", newsIds)
      .order("published_at", { ascending: false })
      .limit(20);
    if (newsError) throw newsError;
    for (const row of newsItems ?? []) {
      const content = [row.title, row.summary].filter(Boolean).join("\n");
      if (!content) continue;
      sources.push({
        content,
        source: toPublicSource({
          id: `news-${String(row.id)}`,
          source_type: "news",
          url: normalizeExternalUrl(row.url == null ? null : String(row.url)),
          title: String(row.title),
          publisher: String(row.source ?? "ニュース").trim() || "ニュース",
          published_at: row.published_at == null ? null : String(row.published_at),
          retrieved_at: now,
          excerpt: content.slice(0, MAX_SOURCE_EXCERPT_CHARS),
          highlight_text: chooseHighlightText(content),
          content,
        }),
      });
    }
  }

  for (const row of documents.data ?? []) {
    const content = String(row.extracted_text ?? "").trim();
    if (!content) continue;
    sources.push({
      content,
      source: toPublicSource({
        id: `document-${String(row.id)}`,
        source_type: "user_document",
        url: normalizeExternalUrl(row.source_url == null ? null : String(row.source_url)),
        title: String(row.title),
        publisher: "ユーザー資料",
        published_at: row.uploaded_at == null ? null : String(row.uploaded_at),
        retrieved_at: now,
        excerpt: content.slice(0, MAX_SOURCE_EXCERPT_CHARS),
        highlight_text: chooseHighlightText(content),
        content,
      }),
    });
  }

  for (const row of statements.data ?? []) {
    const content = formatFinancialStatement(row);
    sources.push({
      content,
      source: toPublicSource({
        id: `financial-${String(row.id)}`,
        source_type: "financial_statement",
        url: null,
        title: `${params.ticker} ${String(row.fiscal_period ?? "")} 財務数値`,
        publisher: formatFinancialPublisher(row.source),
        published_at: row.filed_at == null ? null : String(row.filed_at),
        retrieved_at: now,
        excerpt: content,
        highlight_text: content.slice(0, 400),
        content,
      }),
    });
  }

  if (sources.length === 0 && errors.length === 0) {
    const searchCollection = await searchThesisResearchSources({
      ticker: params.ticker,
      companyName: params.companyName,
    });
    sources.push(...searchCollection.sources);
    errors.push(...searchCollection.errors);
  }

  return { sources: assignSourceRefs(dedupeSources(sources)), errors };
}

function toPublicSource(row: SourceRow): ThesisResearchSource {
  const highlightText = row.highlight_text.trim();
  return {
    ref: row.id,
    sourceType: row.source_type,
    url: row.url,
    title: row.title.trim().slice(0, 300),
    publisher: row.publisher.trim().slice(0, 200),
    publishedAt: row.published_at ?? null,
    retrievedAt: row.retrieved_at ?? new Date().toISOString(),
    excerpt: row.excerpt.trim().slice(0, MAX_SOURCE_EXCERPT_CHARS),
    highlightText: highlightText.slice(0, 600),
    // AI引用の検証前は、取得できた本文の抜粋を根拠として表示しない。
    verified: false,
  };
}

function dedupeSources(sources: CollectedThesisResearchSource[]) {
  const seen = new Set<string>();
  return sources.filter((item) => {
    const key = `${item.source.url ?? item.source.ref}:${item.source.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assignSourceRefs(sources: CollectedThesisResearchSource[]) {
  return sources.map((item, index) => ({
    ...item,
    source: { ...item.source, ref: `S${index + 1}` },
  }));
}

function chooseHighlightText(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 400) || "参照情報あり";
}

function normalizeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatFinancialStatement(row: Record<string, unknown>) {
  return [
    `会計期間: ${String(row.fiscal_period ?? "未取得")}`,
    `売上: ${formatNumber(row.revenue)} ${String(row.currency ?? "")}`,
    `営業利益: ${formatNumber(row.operating_income)} ${String(row.currency ?? "")}`,
    `純利益: ${formatNumber(row.net_income)} ${String(row.currency ?? "")}`,
    `EPS: ${formatNumber(row.eps)}`,
    `自己資本比率: ${formatNumber(row.equity_ratio)}%`,
  ].join("\n");
}

function formatFinancialPublisher(source: unknown) {
  if (source === "edinet") return "EDINET";
  if (source === "manual") return "管理者入力";
  if (source === "mock") return "Mock財務データ";
  return "財務データ";
}

function formatNumber(value: unknown) {
  if (value == null || value === "") return "未取得";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("ja-JP") : "未取得";
}

async function fetchPublicSource(url: string) {
  assertPublicHttpsUrl(url);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "text/html,text/plain;q=0.9" },
  });
  if (!response.ok) throw new Error(`取得失敗: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error("HTMLまたはテキスト形式ではありません");
  }
  const raw = (await response.text()).slice(0, MAX_FETCHED_TEXT_CHARS);
  const content = stripHtml(raw).replace(/\s+/g, " ").trim();
  if (content.length < 30) throw new Error("本文を抽出できませんでした");
  return {
    content,
    excerpt: content.slice(0, MAX_SOURCE_EXCERPT_CHARS),
    highlightText: chooseHighlightText(content),
  };
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}
