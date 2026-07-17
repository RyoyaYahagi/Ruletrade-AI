"use client";

import { useEffect, useState } from "react";

type Assessment = {
  id: string;
  relevance: "affects_thesis" | "not_relevant";
  thesis_relation: string | null;
  summary_text: string | null;
  article: {
    title: string;
    summary: string | null;
    url: string;
    published_at: string;
    source: string;
  } | null;
};

export function NewsAssessmentHistory({ sessionId }: { sessionId: string }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const response = await fetch(`/api/rules/${sessionId}/news`);
        const json = await response.json();
        if (json.ok) setAssessments(json.data.assessments);
        setIsLoading(false);
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionId]);

  if (isLoading) return <p className="text-sm text-muted-foreground">ニュース履歴を読み込み中...</p>;
  if (assessments.length === 0) {
    return <p className="rounded-md border p-6 text-sm text-muted-foreground">まだニュース判定はありません。</p>;
  }

  return (
    <div className="space-y-3">
      {assessments.map((assessment) => (
        <article
          key={assessment.id}
          className={`rounded-md border p-4 ${assessment.relevance === "not_relevant" ? "opacity-60" : ""}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{assessment.relevance === "not_relevant" ? "仮説への関係なし" : "仮説に関係する可能性"}</span>
            <span>{assessment.thesis_relation ?? "関係未分類"}</span>
          </div>
          <h2 className="mt-2 font-medium">{assessment.article?.title ?? "記事を取得できません"}</h2>
          {assessment.summary_text ? <p className="mt-2 whitespace-pre-line text-sm">{assessment.summary_text}</p> : null}
          {assessment.article ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{assessment.article.source} / {new Date(assessment.article.published_at).toLocaleString("ja-JP")}</span>
              <a href={assessment.article.url} target="_blank" rel="noreferrer" className="underline">出典リンク（外部）</a>
            </div>
          ) : null}
          {assessment.relevance === "affects_thesis" ? (
            <p className="mt-3 text-xs text-muted-foreground">この判定はAIによるもので、誤りがあり得ます。</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
