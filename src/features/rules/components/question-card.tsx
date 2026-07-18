"use client";

import { useEffect, useRef, useState } from "react";
import { AnswerInput } from "@/features/rules/components/answer-input";
import { KnowledgeArticleLinks } from "@/features/knowledge/components/knowledge-article-links";
import { QuestionFeedbackPanel } from "@/features/rules/components/question-feedback-panel";
import { getThesisDraftStreamErrorNotice } from "@/features/rules/services/thesis-draft-error-message";
import {
  ThesisDraftResearchPanel,
  type ResearchEvidence,
  type ThesisResearch,
  type ThesisSegment,
} from "@/features/rules/components/thesis-draft-research-panel";

type ThesisDraftCompleted = {
  thesisDraft?: unknown;
  thesisSegments?: ThesisSegment[];
  evidence?: ResearchEvidence[];
  research?: ThesisResearch | null;
  fallbackUsed?: boolean;
  notice?: string;
  traceId?: string | null;
};

type ThesisDraftStreamEvent =
  | { event: "phase"; data: { phase: string; label: string } }
  | { event: "completed"; data: ThesisDraftCompleted }
  | { event: "error"; data: { code?: string; message?: string } };

class ThesisDraftStreamError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ThesisDraftStreamError";
  }
}

type InFlightThesisDraftRequest = {
  promise: Promise<ThesisDraftCompleted>;
  phaseListeners: Set<(label: string) => void>;
};

// React can re-run effects during development; share the stream so that one
// draft request does not trigger multiple AI calls for the same session.
const inFlightThesisDraftRequests = new Map<
  string,
  InFlightThesisDraftRequest
>();

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
  const [draftPhase, setDraftPhase] = useState<string | null>(null);
  const [draftResearch, setDraftResearch] = useState<ThesisResearch | null>(null);
  const [draftTraceId, setDraftTraceId] = useState<string | null>(null);
  const [draftSegments, setDraftSegments] = useState<ThesisSegment[]>([]);
  const [draftEvidence, setDraftEvidence] = useState<ResearchEvidence[]>([]);
  const [draftRetryKey, setDraftRetryKey] = useState(0);
  const [showUnknownDefault, setShowUnknownDefault] = useState(false);
  const startedEventSent = useRef(false);

  useEffect(() => {
    void sendQuestionEngagement({
      sessionId,
      questionId: question.id,
      questionKey: question.question_key,
      eventName: "question_viewed",
    });
    startedEventSent.current = false;
  }, [question.id, question.question_key, sessionId]);

  function markQuestionStarted() {
    if (startedEventSent.current) return;
    startedEventSent.current = true;
    void sendQuestionEngagement({
      sessionId,
      questionId: question.id,
      questionKey: question.question_key,
      eventName: "question_started",
    });
  }

  useEffect(() => {
    if (question.question_key !== "thesis_draft") return;

    let cancelled = false;
    let activeRequest: InFlightThesisDraftRequest | null = null;
    let phaseListener: ((label: string) => void) | null = null;
    async function loadDraft() {
      setIsGeneratingDraft(true);
      setDraftNotice(null);
      setDraftPhase(null);
      setDraftTraceId(null);
      setDraftEvidence([]);
      const requestKey = `${sessionId}:${question.id}:${question.question_key}`;
      activeRequest = getOrCreateThesisDraftRequest(requestKey, sessionId);
      phaseListener = (label) => {
        if (!cancelled) setDraftPhase(label);
      };
      activeRequest.phaseListeners.add(phaseListener);
      try {
        const completed = await activeRequest.promise;
        if (cancelled) return;
        const draft = completed.thesisDraft;
        if (typeof draft === "string" && draft.length > 0) {
          setAnswerText(draft);
          setAnswerJson({ text: draft });
        }
        setDraftSegments(completed.thesisSegments ?? []);
        setDraftEvidence(completed.evidence ?? []);
        setDraftResearch(completed.research ?? null);
        setDraftTraceId(completed.traceId ?? null);
        if (completed.notice) {
          setDraftNotice(completed.notice);
        } else if (completed.fallbackUsed) {
          setDraftNotice(
            "AI下書きの出典を検証できなかったため、仮説欄は空欄にしています。自分の言葉で入力してください。",
          );
        }
      } catch (error) {
        if (!cancelled) {
          const errorCode =
            error instanceof ThesisDraftStreamError ? error.code : undefined;
          setDraftNotice(
            getThesisDraftStreamErrorNotice(errorCode) ??
              "企業調査付きの下書きを取得できませんでした。調査ソースを確認して自分の言葉で入力してください。",
          );
        }
      } finally {
        if (activeRequest && phaseListener) {
          activeRequest.phaseListeners.delete(phaseListener);
        }
        if (!cancelled) setIsGeneratingDraft(false);
      }
    }

    void loadDraft();
    return () => {
      cancelled = true;
      if (activeRequest && phaseListener) {
        activeRequest.phaseListeners.delete(phaseListener);
      }
    };
  }, [draftRetryKey, question.id, question.question_key, sessionId]);

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
    markQuestionStarted();

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
          draftTraceId:
            question.question_key === "thesis_draft"
              ? draftTraceId ?? undefined
              : undefined,
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
          {draftPhase ?? "仮説の下書きを準備しています..."}
        </p>
      ) : null}

      {draftNotice ? (
        <p className="mt-5 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {draftNotice}
        </p>
      ) : null}

      {draftResearch ? (
        <ThesisDraftResearchPanel
          sessionId={sessionId}
          segments={draftSegments}
          evidence={draftEvidence}
          research={draftResearch}
          onSourceAdded={() => setDraftRetryKey((key) => key + 1)}
        />
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
          onAnswerTextChange={(value) => {
            markQuestionStarted();
            setAnswerText(value);
          }}
          onAnswerJsonChange={(value) => {
            markQuestionStarted();
            setAnswerJson(value);
          }}
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
              <KnowledgeArticleLinks topicKey={question.question_key} />
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

      <QuestionFeedbackPanel
        sessionId={sessionId}
        questionId={question.id}
        questionKey={question.question_key}
        draftRunId={draftResearch?.runId ?? null}
      />

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

function getOrCreateThesisDraftRequest(
  requestKey: string,
  sessionId: string,
): InFlightThesisDraftRequest {
  const existing = inFlightThesisDraftRequests.get(requestKey);
  if (existing) return existing;

  const phaseListeners = new Set<(label: string) => void>();
  const promise = fetchThesisDraft(sessionId, (label) => {
    for (const listener of phaseListeners) listener(label);
  });
  const request = { promise, phaseListeners };
  inFlightThesisDraftRequests.set(requestKey, request);
  void promise.then(
    () => {
      if (inFlightThesisDraftRequests.get(requestKey) === request) {
        inFlightThesisDraftRequests.delete(requestKey);
      }
    },
    () => {
      if (inFlightThesisDraftRequests.get(requestKey) === request) {
        inFlightThesisDraftRequests.delete(requestKey);
      }
    },
  );
  return request;
}

async function fetchThesisDraft(
  sessionId: string,
  onPhase: (label: string) => void,
): Promise<ThesisDraftCompleted> {
  const response = await fetch(
    `/api/rule-sessions/${encodeURIComponent(sessionId)}/thesis-draft`,
    { method: "POST" },
  );
  if (!response.ok || !response.body) {
    throw new Error("draft request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: ThesisDraftCompleted | null = null;
  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value ?? new Uint8Array(), {
      stream: !chunk.done,
    });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const rawEvent of events) {
      const event = parseStreamEvent(rawEvent);
      if (!event) continue;
      if (event.event === "phase") {
        onPhase(event.data.label);
      } else if (event.event === "completed") {
        completed = event.data;
      } else if (event.event === "error") {
        throw new ThesisDraftStreamError(
          event.data.message ?? "draft request failed",
          event.data.code,
        );
      }
    }
    if (chunk.done) break;
  }

  if (!completed) throw new Error("draft request completed without a result");
  return completed;
}

function parseStreamEvent(rawEvent: string): ThesisDraftStreamEvent | null {
  const eventName = rawEvent.match(/^event:\s*(\w+)/m)?.[1];
  const dataLine = rawEvent.match(/^data:\s*(.+)$/m)?.[1];
  if (!eventName || !dataLine) return null;
  try {
    return { event: eventName, data: JSON.parse(dataLine) } as ThesisDraftStreamEvent;
  } catch {
    return null;
  }
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

async function sendQuestionEngagement(params: {
  sessionId: string;
  questionId: string;
  questionKey: string;
  eventName: "question_viewed" | "question_started";
}) {
  try {
    await fetch(
      `/api/rule-sessions/${encodeURIComponent(params.sessionId)}/engagement`,
      {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: crypto.randomUUID(),
          eventName: params.eventName,
          questionId: params.questionId,
          questionKey: params.questionKey,
        }),
      },
    );
  } catch {
    // Engagement metrics are best-effort and must not interrupt answering.
    console.debug("Rule engagement event was not recorded.");
  }
}
