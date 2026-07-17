"use client";

import { useEffect, useState } from "react";

export const KNOWLEDGE_DISCLAIMER =
  "この解説は一般的な知識の説明であり、特定の銘柄の売買を勧めるものではありません。";

type KnowledgeArticle = {
  id: string;
  title: string;
  body: string;
  authorName: string;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
};

export function KnowledgeArticleLinks({ topicKey }: { topicKey: string }) {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/knowledge?topicKey=${encodeURIComponent(topicKey)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { data?: { articles?: KnowledgeArticle[] } } | null) => {
        if (!cancelled) setArticles(json?.data?.articles ?? []);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [topicKey]);

  if (articles.length === 0) return null;

  return (
    <div className="mt-4 rounded-md bg-blue-50 p-3" aria-label="関連する解説">
      <p className="text-sm font-medium">もっと詳しく</p>
      <div className="mt-2 space-y-3">
        {articles.map((article) => (
          <article key={article.id} className="rounded border border-blue-100 bg-white p-3">
            <h3 className="font-medium">{article.title}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {article.body}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatKnowledgeArticleCitation(article)}
            </p>
            {article.sourceUrl ? (
              <a className="mt-1 inline-block text-xs underline" href={article.sourceUrl} target="_blank" rel="noreferrer">
                出典URL
              </a>
            ) : null}
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs text-blue-900">{KNOWLEDGE_DISCLAIMER}</p>
    </div>
  );
}

export function formatKnowledgeArticleCitation(article: {
  authorName: string;
  sourceName: string | null;
  publishedAt: string | null;
}) {
  return `著者・監修: ${article.authorName} / 出典: ${article.sourceName ?? "未指定"} / 公開日: ${article.publishedAt ?? "未指定"}`;
}
