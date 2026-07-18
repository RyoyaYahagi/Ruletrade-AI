"use client";

import { useEffect, useState } from "react";
import { CollapsibleDetail } from "@/components/status/collapsible-detail";

export type ResearchSource = {
  ref: string;
  sourceType: string;
  url: string | null;
  title: string;
  publisher: string;
  publishedAt: string | null;
  retrievedAt: string;
  excerpt: string;
  highlightText: string;
  verified: boolean;
};

export type ThesisSegment = {
  text: string;
  sourceRefs: string[];
};

export type ResearchEvidence = {
  sourceRef: string;
  quote: string;
  reason: string;
};

export type ThesisResearch = {
  runId: string;
  status: "completed" | "partial";
  sources: ResearchSource[];
  growthDefinition: string;
  growthIndicators: string[];
  nearTermFactors: string[];
  invalidationConditions: string[];
  errors: string[];
};

export function ThesisDraftResearchPanel({
  sessionId,
  segments,
  evidence,
  research,
  onSourceAdded,
}: {
  sessionId: string;
  segments: ThesisSegment[];
  evidence: ResearchEvidence[];
  research: ThesisResearch;
  onSourceAdded: () => void;
}) {
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [pendingSourceRef, setPendingSourceRef] = useState<string | null>(null);

  useEffect(() => {
    const sourceRef = window.location.hash.match(/^#thesis-source-(S\d+)$/)?.[1];
    if (!sourceRef) return;
    const frame = window.requestAnimationFrame(() => {
      setSourcesOpen(true);
      setPendingSourceRef(sourceRef);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!sourcesOpen || !pendingSourceRef) return;
    const frame = window.requestAnimationFrame(() => {
      const sourceElement = document.getElementById(
        `thesis-source-${pendingSourceRef}`,
      );
      if (!sourceElement) return;
      sourceElement.scrollIntoView({ block: "start" });
      window.history.replaceState(
        null,
        "",
        `#thesis-source-${pendingSourceRef}`,
      );
      setPendingSourceRef(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingSourceRef, research.sources, sourcesOpen]);

  function focusSource(sourceRef: string, event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setPendingSourceRef(sourceRef);
    setSourcesOpen(true);
  }

  return (
    <section className="mt-5 space-y-4 rounded-md border border-blue-200 bg-blue-50/60 p-4" aria-label="仮説の調査根拠">
      <div>
        <h3 className="font-semibold">企業調査に基づく仮説</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          事実と推論を分け、参照した箇所を出典に紐づけています。最終的な文章は自分の言葉に直してください。
        </p>
      </div>

      <div className="rounded-md border bg-white p-3 text-sm">
        <p className="font-medium">読み取り専用プレビュー</p>
        <div className="mt-2 space-y-2 leading-7">
          {segments.map((segment, index) => (
            <p key={`${segment.text}-${index}`}>
              {segment.text}{" "}
              {segment.sourceRefs.map((sourceRef) => (
                <a
                  key={sourceRef}
                  href={`#thesis-source-${sourceRef}`}
                  onClick={(event) => focusSource(sourceRef, event)}
                  className="rounded bg-yellow-200 px-1 text-xs font-medium text-blue-900 underline"
                  aria-label={`${sourceRef}の出典へ移動`}
                >
                  [{sourceRef}]
                </a>
              ))}
            </p>
          ))}
        </div>
      </div>

      <CollapsibleDetail summary="調査サマリー">
        <ResearchSummary research={research} />
      </CollapsibleDetail>

      <CollapsibleDetail
        summary={`参照ソース (${research.sources.length}件)`}
        open={sourcesOpen}
        onToggle={setSourcesOpen}
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowSourceForm((current) => !current)}
            className="rounded-md border bg-white px-3 py-1.5 text-xs underline"
          >
            {showSourceForm ? "登録フォームを閉じる" : "企業IRソースを追加"}
          </button>

          {showSourceForm ? (
            <ResearchSourceForm
              sessionId={sessionId}
              onAdded={() => {
                setShowSourceForm(false);
                onSourceAdded();
              }}
            />
          ) : null}

          {research.sources.map((source) => {
            const sourceEvidence = evidence.filter(
              (item) => item.sourceRef === source.ref,
            );
            return (
              <article
                key={source.ref}
                id={`thesis-source-${source.ref}`}
                className="scroll-mt-4 rounded-md border bg-white p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-800">
                      [{source.ref}] {source.publisher}
                    </p>
                    <h4 className="mt-1 font-medium">{source.title}</h4>
                  </div>
                  {source.url ? (
                    <a
                      href={buildTextFragmentUrl(source.url, source.highlightText)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs underline"
                    >
                      原文を開く
                    </a>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {source.publishedAt ? `公開日: ${source.publishedAt}` : "内部資料"}
                </p>
                {sourceEvidence.length > 0 ? (
                  <div className="mt-2 space-y-2 leading-6">
                    {sourceEvidence.map((item, index) => (
                      <div key={`${item.quote}-${index}`}>
                        <mark className="bg-yellow-200 px-1">{item.quote}</mark>
                        <p className="mt-1 text-xs text-muted-foreground">
                          引用理由: {item.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 leading-6">
                    <mark className="bg-yellow-200 px-1">{source.highlightText}</mark>
                  </p>
                )}
                {source.excerpt !== source.highlightText ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {source.excerpt}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </CollapsibleDetail>

      {research.errors.length > 0 ? (
        <p className="rounded-md bg-amber-100 p-3 text-xs text-amber-900">
          一部のソースを取得できませんでした。{research.errors.join(" / ")}
        </p>
      ) : null}
    </section>
  );
}

function ResearchSummary({ research }: { research: ThesisResearch }) {
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <SummaryBlock title="この企業での成長の定義" items={[research.growthDefinition]} />
      <SummaryBlock title="確認する成長指標" items={research.growthIndicators} />
      <SummaryBlock title="数週間〜数か月の観測要因" items={research.nearTermFactors} />
      <SummaryBlock title="仮説の反証条件" items={research.invalidationConditions} />
    </div>
  );
}

function SummaryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <h4 className="font-medium">{title}</h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function ResearchSourceForm({
  sessionId,
  onAdded,
}: {
  sessionId: string;
  onAdded: () => void;
}) {
  const [sourceType, setSourceType] = useState("company_ir");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/rule-sessions/${sessionId}/research-sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, url, title, publisher, publishedAt: publishedAt || null }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setMessage(json.error?.message ?? "ソースを登録できませんでした。");
        return;
      }
      setUrl("");
      setTitle("");
      setPublisher("");
      setPublishedAt("");
      onAdded();
    } catch {
      setMessage("通信に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-md border bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={sourceType} onChange={(event) => setSourceType(event.target.value)} className="rounded-md border px-2 py-2 text-sm">
          <option value="company_ir">企業IR</option>
          <option value="primary">一次資料</option>
        </select>
        <input value={publisher} onChange={(event) => setPublisher(event.target.value)} placeholder="発行元" className="rounded-md border px-2 py-2 text-sm" required />
      </div>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="資料タイトル" className="w-full rounded-md border px-2 py-2 text-sm" required />
      <input value={publishedAt} onChange={(event) => setPublishedAt(event.target.value)} type="date" className="w-full rounded-md border px-2 py-2 text-sm" aria-label="公開日" />
      <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." type="url" className="w-full rounded-md border px-2 py-2 text-sm" required />
      <button type="submit" disabled={isSaving} className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50">
        {isSaving ? "登録中..." : "ソースを登録"}
      </button>
      {message ? <p className="text-xs text-red-700">{message}</p> : null}
    </form>
  );
}

export function buildTextFragmentUrl(url: string, text: string) {
  let baseUrl = url;
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    baseUrl = parsed.toString();
  } catch {
    baseUrl = url.split("#", 1)[0];
  }
  return `${baseUrl}#:~:text=${encodeURIComponent(stripMarkdownSyntax(text).slice(0, 300))}`;
}

function stripMarkdownSyntax(value: string) {
  return value
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
