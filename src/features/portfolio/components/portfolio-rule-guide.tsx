"use client";

import { useState } from "react";
import {
  PORTFOLIO_RULE_QUESTIONS,
  type PortfolioRuleQuestion,
} from "@/features/portfolio/constants/portfolio-rule-questions";
import { buildDraftFromAnswers } from "@/features/portfolio/services/portfolio-rule-answer-mapping";
import type {
  PortfolioRuleGuidanceAnswer,
  PortfolioRuleGuidanceDraft,
  PortfolioRuleGuidanceResponse,
} from "@/schemas/portfolio/portfolio-rule-guidance-schema";
import type { RiskTolerance } from "@/schemas/portfolio/portfolio-rule-schema";

type PortfolioRuleGuideProps = {
  currentDraft: PortfolioRuleGuidanceDraft;
  onApplySuggestion: (suggestion: PortfolioRuleGuidanceDraft) => void;
};

const RISK_TOLERANCE_LABELS: Record<RiskTolerance, string> = {
  conservative: "慎重寄り",
  balanced: "バランス",
  aggressive: "変動許容寄り",
};

export function PortfolioRuleGuide({
  currentDraft,
  onApplySuggestion,
}: PortfolioRuleGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<PortfolioRuleGuidanceAnswer[]>([]);
  const [multiSelection, setMultiSelection] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [response, setResponse] =
    useState<PortfolioRuleGuidanceResponse | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);

  const questions = PORTFOLIO_RULE_QUESTIONS;
  const currentQuestion: PortfolioRuleQuestion | null =
    stepIndex < questions.length ? questions[stepIndex] : null;
  const isFinished = stepIndex >= questions.length;
  const mapping = isFinished ? buildDraftFromAnswers(answers) : null;

  function startGuide() {
    setIsOpen(true);
    setStepIndex(0);
    setAnswers([]);
    setMultiSelection([]);
    setFreeText("");
    setResponse(null);
    setErrorMessage(null);
    setAppliedMessage(null);
  }

  async function requestSuggestions(
    finalAnswers: PortfolioRuleGuidanceAnswer[],
  ) {
    setIsRequesting(true);
    setErrorMessage(null);

    try {
      const result = await fetch("/api/portfolio/rules/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: finalAnswers,
          draft: currentDraft,
        }),
      });
      const json = await result.json();

      if (!result.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "AIの確認を取得できませんでした。");
        return;
      }

      setResponse(json.data as PortfolioRuleGuidanceResponse);
    } catch {
      setErrorMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setIsRequesting(false);
    }
  }

  async function recordAnswer(
    question: PortfolioRuleQuestion,
    answer: string,
    value: string,
  ) {
    const nextAnswers = [
      ...answers,
      { key: question.key, question: question.text, answer, value },
    ];
    setAnswers(nextAnswers);
    setMultiSelection([]);
    setFreeText("");

    const nextStep = stepIndex + 1;
    setStepIndex(nextStep);

    if (nextStep >= questions.length) {
      await requestSuggestions(nextAnswers);
    }
  }

  function goBack() {
    if (stepIndex === 0 || isRequesting) return;
    setAnswers((current) => current.slice(0, -1));
    setStepIndex((current) => current - 1);
    setMultiSelection([]);
    setFreeText("");
    setResponse(null);
  }

  function toggleMultiSelection(value: string) {
    setMultiSelection((current) => {
      if (value === "none") {
        return current.includes("none") ? [] : ["none"];
      }
      const withoutNone = current.filter((item) => item !== "none");
      return withoutNone.includes(value)
        ? withoutNone.filter((item) => item !== value)
        : [...withoutNone, value];
    });
  }

  if (!isOpen) {
    return (
      <div className="mt-5 rounded-md border border-dashed p-4">
        <p className="text-sm font-medium">数値を一人で決めなくても大丈夫です</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {questions.length}
          個の質問に答えると、回答からそのまま案を組み立てます。反映後も編集できます。
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

  return (
    <div
      className="mt-5 rounded-md border bg-slate-50 p-3"
      data-testid="portfolio-rule-guide"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">AIと一緒に共通ルールを考える</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentQuestion
              ? `質問 ${stepIndex + 1} / ${questions.length}`
              : "回答から組み立てた案を確認できます。"}
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

      {answers.length > 0 ? (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            これまでの回答を見る（{answers.length}件）
          </summary>
          <div className="mt-2 space-y-2" aria-label="AIガイドの回答一覧">
            {answers.map((answer) => (
              <p key={answer.key} className="rounded-md bg-white p-2">
                {answer.question}
                <span className="mt-1 block font-medium text-slate-700">
                  → {answer.answer}
                </span>
              </p>
            ))}
          </div>
        </details>
      ) : null}

      {currentQuestion ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-md border bg-white p-3">
            <p className="text-sm font-medium">{currentQuestion.text}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-slate-700">考え方：</span>
              {currentQuestion.explanation}
            </p>
          </div>

          <div
            className="flex flex-wrap gap-2"
            data-testid="portfolio-rule-guide-options"
          >
            {currentQuestion.options.map((option) =>
              currentQuestion.multiSelect ? (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleMultiSelection(option.value)}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    multiSelection.includes(option.value)
                      ? "border-black bg-black text-white"
                      : "bg-white"
                  }`}
                  data-testid={`portfolio-rule-guide-option-${option.value}`}
                >
                  {option.label}
                </button>
              ) : (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    void recordAnswer(currentQuestion, option.label, option.value)
                  }
                  className="rounded-md border bg-white px-3 py-2 text-sm"
                  data-testid={`portfolio-rule-guide-option-${option.value}`}
                >
                  {option.label}
                </button>
              ),
            )}
          </div>

          {currentQuestion.multiSelect ? (
            <button
              type="button"
              disabled={multiSelection.length === 0}
              onClick={() => {
                const labels = currentQuestion.options
                  .filter((option) => multiSelection.includes(option.value))
                  .map((option) => option.label);
                void recordAnswer(
                  currentQuestion,
                  labels.join("、"),
                  multiSelection.join(","),
                );
              }}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              data-testid="portfolio-rule-guide-submit"
            >
              選んで次へ
            </button>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = freeText.trim();
                if (!trimmed) return;
                void recordAnswer(currentQuestion, trimmed, "free_text");
              }}
              className="space-y-2"
            >
              <label className="block text-xs font-medium">
                選択肢に当てはまらない場合は、自分の言葉で書けます
                <textarea
                  value={freeText}
                  onChange={(event) => setFreeText(event.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="例：迷っているので、まずは小さく始めたい"
                  className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                  data-testid="portfolio-rule-guide-answer"
                />
              </label>
              <button
                type="submit"
                disabled={freeText.trim() === ""}
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                data-testid="portfolio-rule-guide-submit"
              >
                この回答で次へ
              </button>
            </form>
          )}

          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="text-xs text-muted-foreground underline"
            >
              1つ前の質問に戻る
            </button>
          ) : null}
        </div>
      ) : null}

      {mapping ? (
        <div className="mt-4 space-y-3">
          <article
            className="rounded-md border-2 border-black bg-white p-3"
            data-testid="portfolio-rule-guide-primary-draft"
          >
            <p className="text-sm font-medium">
              あなたの回答から組み立てた案
              {mapping.draft.riskTolerance
                ? `（${RISK_TOLERANCE_LABELS[mapping.draft.riskTolerance]}）`
                : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              回答した内容がそのまま反映されます。未定のままにした項目は含まれません。
            </p>
            <button
              type="button"
              onClick={() => {
                onApplySuggestion(mapping.draft);
                setAppliedMessage(
                  "回答から組み立てた案をフォームに反映しました。内容を確認して編集できます。",
                );
              }}
              className="mt-2 rounded-md bg-black px-3 py-2 text-xs text-white"
              data-testid="apply-portfolio-rule-guide-primary-draft"
            >
              この案をフォームに反映
            </button>
          </article>

          {mapping.undecidedKeys.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              まだ決めていない項目: {mapping.undecidedKeys.length}件
              （AIの確認結果で目安が届きます）
            </p>
          ) : null}
        </div>
      ) : null}

      {isRequesting ? (
        <p
          className="mt-4 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
          data-testid="portfolio-rule-guide-loading"
        >
          AIが回答の整合性を確認中…
        </p>
      ) : null}

      {response ? (
        <div className="mt-4 space-y-3">
          <p className="whitespace-pre-wrap text-sm">{response.message}</p>

          {response.consistencyNotes.length > 0 ? (
            <div
              className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3"
              data-testid="portfolio-rule-guide-consistency-notes"
            >
              <p className="text-xs font-medium text-amber-800">
                回答の整合性チェック
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">
                {response.consistencyNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {response.suggestions.length > 0 ? (
            <div
              className="space-y-2"
              aria-label="まだ決めていない項目の目安"
              data-testid="portfolio-rule-guide-suggestions"
            >
              <p className="text-xs font-medium text-muted-foreground">
                まだ決めていない項目の目安
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

          <p className="border-t pt-3 text-xs text-muted-foreground">
            {response.disclaimer}
          </p>
        </div>
      ) : null}

      {appliedMessage ? (
        <p className="mt-3 text-xs text-green-700">{appliedMessage}</p>
      ) : null}

      {errorMessage ? (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <p>{errorMessage}</p>
          {isFinished && !response ? (
            <button
              type="button"
              onClick={() => void requestSuggestions(answers)}
              disabled={isRequesting}
              className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs disabled:opacity-50"
              data-testid="portfolio-rule-guide-retry"
            >
              AIの確認をやり直す
            </button>
          ) : null}
        </div>
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
