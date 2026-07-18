"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type PromptEntry = {
  version: string;
  taskType: string;
  label: string;
  purpose: string;
  sourcePath: string;
  runCount: number;
  lastUsedAt: string | null;
};

type AiRun = {
  id: string;
  taskType: string;
  sourceType: string | null;
  sourceId: string | null;
  provider: string;
  model: string;
  promptVersion: string | null;
  status: string;
  schemaValid: boolean | null;
  safetyPassed: boolean | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  latencyMs: number | null;
  inputPreview: string | null;
  outputPreview: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

type Experiment = {
  id: string;
  title: string;
  hypothesis: string;
  changeSummary: string;
  result: string;
  blockedOn: string;
  nextStep: string;
  status: string;
  promptVersion: string | null;
  provider: string | null;
  model: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type Dashboard = {
  payloadLoggingEnabled: boolean;
  summary: {
    runCount: number;
    successRate: number | null;
    totalCostUsd: number;
    averageLatencyMs: number | null;
    promptVersionCount: number;
  };
  promptCatalog: PromptEntry[];
  runs: AiRun[];
  experiments: Experiment[];
};

const emptyForm = {
  title: "",
  hypothesis: "",
  changeSummary: "",
  result: "",
  blockedOn: "",
  nextStep: "",
  status: "in_progress",
  promptVersion: "",
  provider: "",
  model: "",
  tags: "",
};

const fieldInputClass =
  "mt-1 h-9 w-full rounded-md border bg-background px-3 py-2 text-sm";
const fieldTextareaClass =
  "mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm";

export function DeveloperAiObservabilityPanel() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchDashboard() {
    const response = await fetch("/api/ai/developer-dashboard");
    const json = await response.json();
    if (!response.ok || !json.ok) {
      throw new Error(
        json.error?.message ?? "LLMダッシュボードを読み込めませんでした。",
      );
    }
    return json.data as Dashboard;
  }

  async function load() {
    setError(null);
    setDashboard(await fetchDashboard());
  }

  useEffect(() => {
    let active = true;
    void fetchDashboard()
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "LLMダッシュボードを読み込めませんでした。",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveExperiment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/ai/developer-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(
          json.error?.message ?? "試行ノートを保存できませんでした。",
        );
      }
      setForm(emptyForm);
      setMessage("試行ノートを保存しました。");
      await load();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "試行ノートを保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateForm(key: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        LLMダッシュボードを読み込み中...
      </p>
    );
  }

  if (!dashboard) {
    return (
      <section
        className="rounded-lg border p-6"
        data-testid="developer-ai-observability"
      >
        <h2 className="text-lg font-semibold">LLM開発ダッシュボード</h2>
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error ?? "LLMダッシュボードを表示できませんでした。"}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6" data-testid="developer-ai-observability">
      <div>
        <h2 className="text-xl font-semibold">LLM開発ダッシュボード</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          LLMを組み込む際の試行、プロンプトの変更、詰まりや次の一手を残します。
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="text-sm text-green-700"
          role="status"
          data-testid="developer-ai-experiment-message"
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="実行数" value={String(dashboard.summary.runCount)} />
        <MetricCard
          label="成功率"
          value={
            dashboard.summary.successRate === null
              ? "-"
              : `${dashboard.summary.successRate}%`
          }
        />
        <MetricCard
          label="推定コスト"
          value={`$${dashboard.summary.totalCostUsd.toFixed(4)}`}
        />
        <MetricCard
          label="平均レイテンシ"
          value={
            dashboard.summary.averageLatencyMs === null
              ? "-"
              : `${dashboard.summary.averageLatencyMs}ms`
          }
        />
        <MetricCard
          label="使用prompt数"
          value={String(dashboard.summary.promptVersionCount)}
        />
      </div>

      <section className="rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">プロンプト台帳</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              実装中のprompt versionと、その変更対象を把握します。
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs">
            {dashboard.promptCatalog.length} prompts
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3">用途</th>
                <th className="py-2 pr-3">Version</th>
                <th className="py-2 pr-3">目的</th>
                <th className="py-2 pr-3">実装箇所</th>
                <th className="py-2 text-right">実行数</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.promptCatalog.map((prompt) => (
                <tr
                  key={prompt.version}
                  className="border-b align-top last:border-0"
                >
                  <td className="py-3 pr-3 font-medium">{prompt.label}</td>
                  <td className="py-3 pr-3 font-mono text-xs">
                    {prompt.version}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {prompt.purpose}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">
                    {prompt.sourcePath}
                  </td>
                  <td className="py-3 text-right">{prompt.runCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">試行錯誤を記録する</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              「何を試したか」「なぜそうしたか」「どこで詰まったか」を後から話せる形にします。
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            secretらしき値は保存時にマスク
          </span>
        </div>
        <form className="mt-4 space-y-4" onSubmit={saveExperiment}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="タイトル" required>
              <input
                className={fieldInputClass}
                data-testid="developer-ai-experiment-title"
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                required
              />
            </Field>
            <Field label="prompt version / provider / model">
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  className={fieldInputClass}
                  aria-label="prompt version"
                  value={form.promptVersion}
                  onChange={(event) =>
                    updateForm("promptVersion", event.target.value)
                  }
                >
                  <option value="">prompt versionなし</option>
                  {dashboard.promptCatalog.map((prompt) => (
                    <option key={prompt.version} value={prompt.version}>
                      {prompt.version}
                    </option>
                  ))}
                </select>
                <input
                  className={fieldInputClass}
                  aria-label="provider"
                  placeholder="provider"
                  value={form.provider}
                  onChange={(event) =>
                    updateForm("provider", event.target.value)
                  }
                />
                <input
                  className={fieldInputClass}
                  aria-label="model"
                  placeholder="model"
                  value={form.model}
                  onChange={(event) => updateForm("model", event.target.value)}
                />
              </div>
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="仮説" required>
              <textarea
                className={fieldTextareaClass}
                value={form.hypothesis}
                onChange={(event) =>
                  updateForm("hypothesis", event.target.value)
                }
                required
              />
            </Field>
            <Field label="変更したこと・工夫したこと" required>
              <textarea
                className={fieldTextareaClass}
                data-testid="developer-ai-experiment-change"
                value={form.changeSummary}
                onChange={(event) =>
                  updateForm("changeSummary", event.target.value)
                }
                required
              />
            </Field>
            <Field label="結果・観測できたこと">
              <textarea
                className={fieldTextareaClass}
                value={form.result}
                onChange={(event) => updateForm("result", event.target.value)}
              />
            </Field>
            <Field label="詰まった点">
              <textarea
                className={fieldTextareaClass}
                value={form.blockedOn}
                onChange={(event) =>
                  updateForm("blockedOn", event.target.value)
                }
              />
            </Field>
            <Field label="次の一手">
              <textarea
                className={fieldTextareaClass}
                value={form.nextStep}
                onChange={(event) => updateForm("nextStep", event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="状態">
                <select
                  className={fieldInputClass}
                  value={form.status}
                  onChange={(event) => updateForm("status", event.target.value)}
                >
                  <option value="in_progress">進行中</option>
                  <option value="validated">検証済み</option>
                  <option value="blocked">詰まり中</option>
                  <option value="archived">保留・アーカイブ</option>
                </select>
              </Field>
              <Field label="タグ（カンマ区切り）">
                <input
                  className={fieldInputClass}
                  placeholder="prompt, latency, eval"
                  value={form.tags}
                  onChange={(event) => updateForm("tags", event.target.value)}
                />
              </Field>
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            data-testid="developer-ai-experiment-save"
            disabled={saving}
          >
            {saving ? "保存中..." : "試行ノートを保存"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">最近のAI実行</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              最大100件。入力本文はpayload logging、出力本文はそれに加えてSafety
              Check済みの実行だけ表示します。
            </p>
          </div>
          {!dashboard.payloadLoggingEnabled ? (
            <a className="text-sm underline" href="/settings/privacy">
              AI入出力ログを有効にする
            </a>
          ) : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3">開始日時</th>
                <th className="py-2 pr-3">task / prompt</th>
                <th className="py-2 pr-3">provider / model</th>
                <th className="py-2 pr-3">結果</th>
                <th className="py-2 pr-3 text-right">tokens</th>
                <th className="py-2 pr-3 text-right">latency</th>
                <th className="py-2 text-right">cost</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.runs.map((run) => (
                <tr key={run.id} className="border-b align-top last:border-0">
                  <td className="whitespace-nowrap py-3 pr-3 text-xs">
                    {formatDate(run.startedAt)}
                  </td>
                  <td className="py-3 pr-3">
                    <div>{run.taskType}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {run.promptVersion ?? "未設定"}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    {run.provider}
                    <br />
                    {run.model}
                  </td>
                  <td className="py-3 pr-3">
                    <span className={statusClass(run.status)}>
                      {run.status}
                    </span>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Schema: {formatBoolean(run.schemaValid)} / Safety:{" "}
                      {formatBoolean(run.safetyPassed)}
                    </div>
                    {run.errorCode ? (
                      <div className="mt-1 max-w-[220px] text-xs text-red-700">
                        {run.errorCode}: {run.errorMessage}
                      </div>
                    ) : null}
                    {run.inputPreview || run.outputPreview ? (
                      <details className="mt-2 max-w-[360px] text-xs">
                        <summary className="cursor-pointer underline">
                          本文プレビュー
                        </summary>
                        {run.inputPreview ? (
                          <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">
                            入力{`\n`}
                            {run.inputPreview}
                          </pre>
                        ) : null}
                        {run.outputPreview ? (
                          <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">
                            出力{`\n`}
                            {run.outputPreview}
                          </pre>
                        ) : null}
                      </details>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 text-right text-xs">
                    {run.inputTokens ?? "-"} / {run.outputTokens ?? "-"}
                  </td>
                  <td className="py-3 pr-3 text-right text-xs">
                    {run.latencyMs === null ? "-" : `${run.latencyMs}ms`}
                  </td>
                  <td className="py-3 text-right text-xs">
                    {run.estimatedCostUsd === null
                      ? "-"
                      : `$${run.estimatedCostUsd.toFixed(4)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dashboard.runs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              まだAI実行ログはありません。
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border p-5">
        <h3 className="font-semibold">試行ノート履歴</h3>
        <div className="mt-4 space-y-3">
          {dashboard.experiments.map((experiment) => (
            <article
              key={experiment.id}
              className="rounded-md border p-4"
              data-testid="developer-ai-experiment-note"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium">{experiment.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(experiment.createdAt)} · {experiment.status}
                    {experiment.promptVersion
                      ? ` · ${experiment.promptVersion}`
                      : ""}
                  </p>
                </div>
                {experiment.tags.length ? (
                  <div className="text-xs text-muted-foreground">
                    {experiment.tags.join(" · ")}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <NoteBlock label="仮説" text={experiment.hypothesis} />
                <NoteBlock label="変更・工夫" text={experiment.changeSummary} />
                {experiment.result ? (
                  <NoteBlock label="結果" text={experiment.result} />
                ) : null}
                {experiment.blockedOn ? (
                  <NoteBlock label="詰まり" text={experiment.blockedOn} />
                ) : null}
                {experiment.nextStep ? (
                  <NoteBlock label="次の一手" text={experiment.nextStep} />
                ) : null}
              </div>
            </article>
          ))}
          {dashboard.experiments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだ試行ノートはありません。最初の実験を記録しましょう。
            </p>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function NoteBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP");
}

function formatBoolean(value: boolean | null) {
  return value === null ? "-" : value ? "pass" : "fail";
}

function statusClass(status: string) {
  if (status === "succeeded") return "text-green-700";
  if (status === "failed" || status === "timeout") return "text-red-700";
  return "text-muted-foreground";
}
