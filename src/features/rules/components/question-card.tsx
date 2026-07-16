"use client";

import { useEffect, useRef, useState } from "react";
import { AnswerInput } from "@/features/rules/components/answer-input";

type ThesisDraftResponse = {
  ok?: boolean;
  data?: {
    thesisDraft?: unknown;
    fallbackUsed?: unknown;
  };
};

export function QuestionCard({
  sessionId,
  question,
  onSaved,
}: {
  sessionId: string;
  question: {
    id: string;
    question_key: string;
    question_text: string;
    question_type: string;
    help_text?: string | null;
    priority: number;
    options?: unknown;
    allow_unknown?: number | boolean | null;
    unknown_default_json?: unknown;
    breaker_source?: string | null;
  };
  onSaved: () => void;
}) {
  const [answerText, setAnswerText] = useState("");
  const [answerJson, setAnswerJson] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [showUnknownDefault, setShowUnknownDefault] = useState(false);
  const draftRequestRef = useRef<{
    key: string;
    promise: Promise<{ ok: boolean; json: ThesisDraftResponse }>;
  } | null>(null);

  useEffect(() => {
    if (question.question_key !== "thesis_draft") return;

    let cancelled = false;
    const requestKey = `${sessionId}:${question.id}`;
    async function loadDraft() {
      setIsGeneratingDraft(true);
      setDraftNotice(null);
      try {
        const existingRequest = draftRequestRef.current;
        const draftRequest =
          existingRequest?.key === requestKey
            ? existingRequest.promise
            : fetch(
                `/api/rule-sessions/${encodeURIComponent(sessionId)}/thesis-draft`,
                { method: "POST" },
              ).then(async (response) => ({
                ok: response.ok,
                json: (await response.json()) as ThesisDraftResponse,
              }));
        draftRequestRef.current = { key: requestKey, promise: draftRequest };

        const result = await draftRequest;
        if (cancelled) return;
        if (result.ok && result.json.ok && result.json.data) {
          const draft = result.json.data.thesisDraft;
          if (typeof draft === "string" && draft.length > 0) {
            setAnswerText(draft);
            setAnswerJson({ text: draft });
          }
          if (result.json.data.fallbackUsed) {
            setDraftNotice(
              "AI下書きが作れなかったため、一般的な確認項目を表示しています。仮説は自分の言葉で入力できます。",
            );
          }
        }
      } catch {
        if (!cancelled) {
          setDraftNotice("下書きの取得に失敗しました。自分の言葉で入力してください。");
        }
      } finally {
        if (!cancelled) setIsGeneratingDraft(false);
      }
    }

    void loadDraft();
    return () => {
      cancelled = true;
    };
  }, [question.id, question.question_key, sessionId]);

  const unknownDefault = parseUnknownDefault(question.unknown_default_json);

  async function saveAnswer(next: {
    answerText: string;
    answerJson: Record<string, unknown>;
  }) {
    const persistedAnswerJson =
      question.question_key === "thesis_breakers_pick" &&
      question.breaker_source === "fallback"
        ? { ...next.answerJson, breakerSource: "fallback" }
        : next.answerJson;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/rule-sessions/${sessionId}/answers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: question.id,
          questionKey: question.question_key,
          answerText: next.answerText,
          answerJson: persistedAnswerJson,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "回答の保存に失敗しました。");
        return;
      }

      setAnswerText("");
      setAnswerJson({});
      onSaved();
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAnswer({ answerText, answerJson });
  }

  async function handleSkip() {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/rule-sessions/${encodeURIComponent(sessionId)}/questions/${encodeURIComponent(question.id)}/skip`,
        { method: "POST" },
      );
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "質問の保留に失敗しました。");
        return;
      }
      onSaved();
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">質問</p>
          <h2 className="mt-1 text-lg font-semibold">
            {question.question_text}
          </h2>

          {question.help_text ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {question.help_text}
            </p>
          ) : null}
        </div>

        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
          priority {question.priority}
        </span>
      </div>

      {isGeneratingDraft ? (
        <p className="mt-5 rounded-md bg-gray-50 p-3 text-sm text-muted-foreground">
          仮説の下書きを準備しています...
        </p>
      ) : null}

      {draftNotice ? (
        <p className="mt-5 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {draftNotice}
        </p>
      ) : null}

      {question.question_key === "thesis_breakers_pick" &&
      question.breaker_source === "fallback" ? (
        <p className="mt-5 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          AI下書きが作れなかったため、一般的な確認項目を表示しています。
        </p>
      ) : null}

      <div className="mt-5">
        <AnswerInput
          question={question}
          answerText={answerText}
          answerJson={answerJson}
          onAnswerTextChange={setAnswerText}
          onAnswerJsonChange={setAnswerJson}
        />
      </div>

      {isUnknownEnabled(question.allow_unknown) && unknownDefault ? (
        <div className="mt-5">
          {!showUnknownDefault ? (
            <button
              type="button"
              onClick={() => setShowUnknownDefault(true)}
              className="text-sm text-muted-foreground underline"
            >
              まだ決めていない
            </button>
          ) : (
            <div className="rounded-md border border-dashed p-4">
              <p className="text-sm font-medium">{unknownDefault.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {unknownDefault.explanation}
              </p>
              <p className="mt-2 text-sm">
                設定値: {formatDefaultValue(unknownDefault.value)}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    void saveAnswer({
                      answerText: unknownDefault.label,
                      answerJson: {
                        unknown: true,
                        appliedDefault: true,
                        value: unknownDefault.value,
                      },
                    })
                  }
                  className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  この設定を使う
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSkip()}
                  className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                >
                  あとで決める
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSaving}
        className="mt-5 rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isSaving ? "保存中..." : "回答を保存"}
      </button>
    </form>
  );
}

function isUnknownEnabled(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

function parseUnknownDefault(value: unknown) {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.label !== "string" ||
    typeof candidate.explanation !== "string" ||
    !("value" in candidate)
  ) {
    return null;
  }
  return {
    value: candidate.value,
    label: candidate.label,
    explanation: candidate.explanation,
  };
}

function formatDefaultValue(value: unknown) {
  if (value === null || value === undefined) return "未設定";
  if (Array.isArray(value)) return value.length > 0 ? value.join("、") : "未選択";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
