"use client";

import { useState } from "react";
import { AnswerInput } from "@/features/rules/components/answer-input";

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
  };
  onSaved: () => void;
}) {
  const [answerText, setAnswerText] = useState("");
  const [answerJson, setAnswerJson] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
          answerText,
          answerJson,
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

      <div className="mt-5">
        <AnswerInput
          question={question}
          answerText={answerText}
          answerJson={answerJson}
          onAnswerTextChange={setAnswerText}
          onAnswerJsonChange={setAnswerJson}
        />
      </div>

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
