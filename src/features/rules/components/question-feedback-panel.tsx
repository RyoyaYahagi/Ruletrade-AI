"use client";

import { useEffect, useState } from "react";

type Quality = "good" | "needs_improvement";
type DraftEffort = "reduced" | "unchanged" | "increased" | "not_used";

type FeedbackState = {
  questionQuality: Quality | null;
  choiceQuality: Quality | null;
  draftEffort: DraftEffort | null;
  reason: string;
};

const EMPTY_FEEDBACK: FeedbackState = {
  questionQuality: null,
  choiceQuality: null,
  draftEffort: null,
  reason: "",
};

export function QuestionFeedbackPanel({
  sessionId,
  questionId,
  questionKey,
  draftRunId,
}: {
  sessionId: string;
  questionId: string;
  questionKey: string;
  draftRunId?: string | null;
}) {
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasDraftDimension = questionKey === "thesis_draft";

  useEffect(() => {
    let cancelled = false;
    async function loadFeedback() {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/rule-sessions/${encodeURIComponent(sessionId)}/question-feedback?questionId=${encodeURIComponent(questionId)}`,
        );
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error("feedback request failed");
        const stored = json.data?.feedback;
        if (!cancelled && stored) {
          setFeedback({
            questionQuality: stored.question_quality ?? null,
            choiceQuality: stored.choice_quality ?? null,
            draftEffort: stored.draft_effort ?? null,
            reason: stored.reason ?? "",
          });
        }
      } catch {
        if (!cancelled) setErrorMessage("フィードバックを読み込めませんでした。");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadFeedback();
    return () => {
      cancelled = true;
    };
  }, [questionId, sessionId]);

  async function saveFeedback() {
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/rule-sessions/${encodeURIComponent(sessionId)}/question-feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId,
            questionQuality: feedback.questionQuality,
            choiceQuality: feedback.choiceQuality,
            draftEffort: hasDraftDimension ? feedback.draftEffort : null,
            reason: feedback.reason.trim() || null,
            draftRunId: hasDraftDimension ? draftRunId ?? null : null,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "フィードバックを保存できませんでした。");
        return;
      }
      setMessage("フィードバックを保存しました。");
    } catch {
      setErrorMessage("通信に失敗しました。フィードバックを保存できませんでした。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-md border border-dashed p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">この質問について教えてください</p>
          <p className="mt-1 text-xs text-muted-foreground">
            回答内容ではなく、質問や下書きの使いやすさへのフィードバックです。
          </p>
        </div>
        {isLoading ? (
          <span className="text-xs text-muted-foreground">読み込み中...</span>
        ) : null}
      </div>

      <FeedbackChoice
        label="この質問は良い質問でしたか？"
        value={feedback.questionQuality}
        onChange={(value) => setFeedback((current) => ({ ...current, questionQuality: value }))}
        goodLabel="👍 良い質問"
        badLabel="👎 改善してほしい"
      />
      <FeedbackChoice
        label="回答方法・選択肢は十分でしたか？"
        value={feedback.choiceQuality}
        onChange={(value) => setFeedback((current) => ({ ...current, choiceQuality: value }))}
        goodLabel="👍 良い選択肢"
        badLabel="👎 改善してほしい"
      />

      {hasDraftDimension ? (
        <div className="mt-4">
          <p className="text-sm font-medium">AI下書きで手間は減りましたか？</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["reduced", "減った"],
                ["unchanged", "変わらない"],
                ["increased", "増えた"],
                ["not_used", "使わなかった"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={feedback.draftEffort === value}
                onClick={() => setFeedback((current) => ({ ...current, draftEffort: value }))}
                className={choiceClass(feedback.draftEffort === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <label className="mt-4 block text-sm">
        理由や改善案（任意）
        <textarea
          value={feedback.reason}
          maxLength={1000}
          onChange={(event) => setFeedback((current) => ({ ...current, reason: event.target.value }))}
          placeholder="例: この順番だと考えやすかった／選択肢に○○がほしい"
          className="mt-2 min-h-20 w-full rounded-md border px-3 py-2 text-sm"
        />
      </label>

      {errorMessage ? (
        <p className="mt-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      <button
        type="button"
        onClick={() => void saveFeedback()}
        disabled={isSaving || isLoading}
        className="mt-3 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
      >
        {isSaving ? "送信中..." : "フィードバックを送信"}
      </button>
    </div>
  );
}

function FeedbackChoice({
  label,
  value,
  onChange,
  goodLabel,
  badLabel,
}: {
  label: string;
  value: Quality | null;
  onChange: (value: Quality) => void;
  goodLabel: string;
  badLabel: string;
}) {
  return (
    <div className="mt-4">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={value === "good"}
          onClick={() => onChange("good")}
          className={choiceClass(value === "good")}
        >
          {goodLabel}
        </button>
        <button
          type="button"
          aria-pressed={value === "needs_improvement"}
          onClick={() => onChange("needs_improvement")}
          className={choiceClass(value === "needs_improvement")}
        >
          {badLabel}
        </button>
      </div>
    </div>
  );
}

function choiceClass(selected: boolean) {
  return selected
    ? "rounded-md bg-black px-3 py-2 text-sm text-white"
    : "rounded-md border px-3 py-2 text-sm";
}
