"use client";

import { useEffect, useState } from "react";

type Analytics = {
  period: { from: string; to: string };
  sessions: {
    started: number;
    resumed: number;
    completed: number;
    completionRate: number;
    abandoned: number;
    abandonmentRate: number;
  };
  questions: Array<{
    questionKey: string;
    viewed: number;
    started: number;
    answered: number;
    skipped: number;
    answerRate: number;
    skipRate: number;
    abandoned: number;
    abandonmentRate: number;
    medianAnswerTimeMs: number | null;
  }>;
  aiDrafts: {
    requested: number;
    succeeded: number;
    failed: number;
    cacheHit: number;
    accepted: number;
    edited: number;
    manual: number;
    successRate: number;
    acceptanceRate: number;
    editedRate: number;
  };
  recentTraces: Array<{
    id: string;
    question_key?: string | null;
    trace_type?: string | null;
    status?: string | null;
    model?: string | null;
    created_at?: string | null;
  }>;
};

export function AdminRuleAnalyticsPanel() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [trace, setTrace] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/rule-analytics")
      .then(async (response) => ({ response, json: await response.json() }))
      .then(({ response, json }) => {
        if (!active) return;
        if (!response.ok || !json.ok) {
          setErrorMessage(json.error?.message ?? "分析データを取得できませんでした。");
          return;
        }
        setAnalytics(json.data);
      })
      .catch(() => {
        if (active) setErrorMessage("分析データを取得できませんでした。");
      });
    return () => {
      active = false;
    };
  }, []);

  async function loadTrace(traceId: string) {
    const response = await fetch(
      `/api/admin/rule-analytics/traces/${encodeURIComponent(traceId)}`,
    );
    const json = await response.json();
    if (response.ok && json.ok) setTrace(json.data);
  }

  if (errorMessage) {
    return <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="セッション開始" value={analytics?.sessions.started} />
        <MetricCard label="完了率" value={formatRate(analytics?.sessions.completionRate)} />
        <MetricCard label="離脱率" value={formatRate(analytics?.sessions.abandonmentRate)} />
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">質問別ファネル</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">質問</th>
                <th className="py-2 text-right">表示</th>
                <th className="py-2 text-right">回答率</th>
                <th className="py-2 text-right">スキップ率</th>
                <th className="py-2 text-right">離脱</th>
                <th className="py-2 text-right">回答時間中央値</th>
              </tr>
            </thead>
            <tbody>
              {analytics?.questions.map((question) => (
                <tr key={question.questionKey} className="border-b">
                  <td className="py-2 font-mono">{question.questionKey}</td>
                  <td className="py-2 text-right">{question.viewed}</td>
                  <td className="py-2 text-right">{formatRate(question.answerRate)}</td>
                  <td className="py-2 text-right">{formatRate(question.skipRate)}</td>
                  <td className="py-2 text-right">{question.abandoned}</td>
                  <td className="py-2 text-right">{formatDuration(question.medianAnswerTimeMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">AI下書き</h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
          <MetricCard label="生成成功率" value={formatRate(analytics?.aiDrafts.successRate)} />
          <MetricCard label="キャッシュ利用" value={analytics?.aiDrafts.cacheHit} />
          <MetricCard label="そのまま採用率" value={formatRate(analytics?.aiDrafts.acceptanceRate)} />
          <MetricCard label="編集採用率" value={formatRate(analytics?.aiDrafts.editedRate)} />
        </div>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">伏字済みAIトレース</h2>
        <p className="mt-1 text-sm text-muted-foreground">本文の保存を許可したユーザーの直近30日分のみ表示します。</p>
        <ul className="mt-3 space-y-2 text-sm">
          {analytics?.recentTraces.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full rounded border p-3 text-left hover:bg-gray-50"
                onClick={() => void loadTrace(item.id)}
              >
                <span className="font-mono">{item.question_key ?? item.trace_type}</span>
                <span className="ml-3 text-muted-foreground">{item.status} / {item.model ?? "-"}</span>
              </button>
            </li>
          ))}
        </ul>
        {trace ? (
          <pre className="mt-4 max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs">{JSON.stringify(trace, null, 2)}</pre>
        ) : null}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="rounded border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value ?? "-"}</p>
    </div>
  );
}

function formatRate(value: number | undefined) {
  return value === undefined ? "-" : `${(value * 100).toFixed(1)}%`;
}

function formatDuration(value: number | null | undefined) {
  if (value == null) return "-";
  return value < 60_000 ? `${Math.round(value / 1000)}秒` : `${(value / 60_000).toFixed(1)}分`;
}
