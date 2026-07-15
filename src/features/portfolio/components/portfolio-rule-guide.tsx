"use client";

import { useState } from "react";
import type {
  PortfolioRuleGuidanceDraft,
  PortfolioRuleGuidanceMessage,
  PortfolioRuleGuidanceResponse,
} from "@/schemas/portfolio/portfolio-rule-guidance-schema";

type PortfolioRuleGuideProps = {
  currentDraft: PortfolioRuleGuidanceDraft;
  onApplySuggestion: (suggestion: PortfolioRuleGuidanceDraft) => void;
};

function responseToMessage(response: PortfolioRuleGuidanceResponse) {
  return [response.message, response.question?.text].filter(Boolean).join("\n");
}

export function PortfolioRuleGuide({
  currentDraft,
  onApplySuggestion,
}: PortfolioRuleGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<PortfolioRuleGuidanceMessage[]>([]);
  const [response, setResponse] =
    useState<PortfolioRuleGuidanceResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);

  async function requestGuidance(nextHistory: PortfolioRuleGuidanceMessage[]) {
    setIsRequesting(true);
    setErrorMessage(null);
    setAppliedMessage(null);

    try {
      const result = await fetch("/api/portfolio/rules/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: nextHistory,
          draft: currentDraft,
        }),
      });
      const json = await result.json();

      if (!result.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "AIガイドを取得できませんでした。");
        return;
      }

      const nextResponse = json.data as PortfolioRuleGuidanceResponse;
      setResponse(nextResponse);
      setHistory([
        ...nextHistory,
        { role: "assistant", content: responseToMessage(nextResponse) },
      ]);
    } catch {
      setErrorMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setIsRequesting(false);
    }
  }

  async function startGuide() {
    setIsOpen(true);
    setHistory([]);
    setResponse(null);
    setAnswer("");
    await requestGuidance([]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer || isRequesting) return;

    const nextHistory = [
      ...history,
      { role: "user" as const, content: trimmedAnswer },
    ];
    setAnswer("");
    await requestGuidance(nextHistory);
  }

  if (!isOpen) {
    return (
      <div className="mt-5 rounded-md border border-dashed p-4">
        <p className="text-sm font-medium">数値を一人で決めなくても大丈夫です</p>
        <p className="mt-1 text-sm text-muted-foreground">
          条件を整理し、比較できる参考案を最大3つ表示します。反映後も編集できます。
        </p>
        <button
          type="button"
          onClick={startGuide}
          className="mt-3 rounded-md border px-3 py-2 text-sm"
          data-testid="start-portfolio-rule-guide"
        >
          AIと一緒に作る
        </button>
      </div>
    );
  }

  const previousMessages = history.slice(0, -1);

  return (
    <div
      className="mt-5 rounded-md border bg-slate-50 p-3"
      data-testid="portfolio-rule-guide"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">AIと一緒に共通ルールを考える</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            条件に合わせた参考案を比べて、自分で選べます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs text-muted-foreground underline"
        >
          閉じる
        </button>
      </div>

      {previousMessages.length > 0 ? (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            これまでの回答を見る（{previousMessages.filter((message) => message.role === "user").length}件）
          </summary>
          <div className="mt-2 space-y-2" aria-label="AIガイドの会話履歴">
            {previousMessages.map((message, index) => (
              <p
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "rounded-md bg-white p-2"
                    : "rounded-md border border-slate-200 p-2"
                }
              >
                {message.content}
              </p>
            ))}
          </div>
        </details>
      ) : null}

      {isRequesting && !response ? (
        <p className="mt-4 text-sm text-muted-foreground">AIガイドを準備中...</p>
      ) : null}

      {response ? (
        <div className="mt-4 space-y-3">
          <p className="whitespace-pre-wrap text-sm">{response.message}</p>

          {response.question ? (
            <div className="rounded-md border bg-white p-3">
              <p className="text-sm font-medium">{response.question.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-slate-700">考え方：</span>
                {response.question.explanation}
              </p>
            </div>
          ) : null}

          {response.suggestions.length > 0 ? (
            <div
              className="space-y-2"
              aria-label="ポートフォリオ共通ルールの参考案"
              data-testid="portfolio-rule-guide-suggestions"
            >
              <p className="text-xs font-medium text-muted-foreground">
                条件から考えられる参考案
              </p>
              {response.suggestions.map((suggestion) => (
                <article
                  key={suggestion.key}
                  className="rounded-md border bg-white p-3"
                  data-testid={`portfolio-rule-guide-suggestion-${suggestion.key}`}
                >
                  <p className="text-sm font-medium">{suggestion.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {suggestion.summary}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    トレードオフ: {suggestion.tradeoff}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onApplySuggestion(suggestion.draft);
                      setAppliedMessage(
                        `${suggestion.title}をフォームに反映しました。内容を確認して編集できます。`,
                      );
                    }}
                    className="mt-2 rounded-md bg-black px-3 py-2 text-xs text-white"
                    data-testid={`apply-portfolio-rule-guide-suggestion-${suggestion.key}`}
                  >
                    この案をフォームに反映
                  </button>
                </article>
              ))}
            </div>
          ) : null}

          {response.readyToReview ? (
            <p className="text-xs text-muted-foreground">参考案を比較できます。</p>
          ) : null}

          {appliedMessage ? (
            <p className="text-xs text-green-700">{appliedMessage}</p>
          ) : null}

          {response.guidance.length > 0 ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">判断材料を見る</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {response.guidance.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {response.question ? (
            <form onSubmit={handleSubmit} className="space-y-2">
              <label className="block text-xs font-medium">
                あなたの考え
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="まだ決めていない場合は、そのまま書いてください"
                  className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                  data-testid="portfolio-rule-guide-answer"
                />
              </label>
              <button
                type="submit"
                disabled={isRequesting || answer.trim() === ""}
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                data-testid="portfolio-rule-guide-submit"
              >
                {isRequesting ? "考え中..." : "回答して次へ"}
              </button>
            </form>
          ) : null}

          <p className="border-t pt-3 text-xs text-muted-foreground">
            {response.disclaimer}
          </p>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        onClick={startGuide}
        className="mt-3 text-xs text-muted-foreground underline"
        disabled={isRequesting}
      >
        最初からやり直す
      </button>
    </div>
  );
}
