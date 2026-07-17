"use client";

import { useRuleSession } from "@/features/rules/hooks/use-rule-session";
import { QuestionCard } from "@/features/rules/components/question-card";
import { RuleDraftView } from "@/features/rules/components/rule-draft-view";
import { RuleReviewPanel } from "@/features/rules/components/rule-review-panel";
import { ReviewActionBar } from "@/features/rules/components/review-action-bar";
import { FinalizeRuleButton } from "@/features/rules/components/finalize-rule-button";
import { FinancialStatementCard } from "@/features/financials/components/financial-statement-card";

type RuleSessionData = {
  session: {
    ticker: string;
    company_name?: string | null;
    rule_json: unknown;
    completion_score: number | null;
  };
  answers: Array<{
    question_key: string;
    answer_json?: unknown;
  }>;
  questions: Array<{
    id: string;
    question_key: string;
    question_text: string;
    question_type: string;
    help_text?: string | null;
    priority: number;
    status: string;
    options?: unknown;
    allow_unknown?: number | boolean | null;
    unknown_default_json?: unknown;
    breaker_source?: string | null;
  }>;
  latestReview: {
    can_finalize: boolean;
    completion_score: number | null;
    summary?: string | null;
    safety_passed?: boolean | null;
  } | null;
  qualityChecks: Array<{
    id: string;
    label: string;
    status: string;
    reason: string;
    suggested_question?: string | null;
  }>;
  latestFinancialStatement?: {
    fiscal_period?: string | null;
    revenue?: number | null;
    operating_income?: number | null;
    net_income?: number | null;
    eps?: number | null;
    dividend_per_share?: number | null;
    equity_ratio?: number | null;
    currency?: string | null;
    filed_at?: string | null;
    source?: string | null;
  } | null;
};

function isRuleSessionData(data: unknown): data is RuleSessionData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.session === "object" &&
    d.session !== null &&
    Array.isArray(d.questions) &&
    Array.isArray(d.answers) &&
    (d.latestReview === null || typeof d.latestReview === "object") &&
    Array.isArray(d.qualityChecks)
  );
}

export function RuleSessionShell({ sessionId }: { sessionId: string }) {
  const { data, isLoading, errorMessage, reload } = useRuleSession(sessionId);

  if (isLoading) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">{errorMessage}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-4 rounded-md border px-3 py-2 text-sm"
        >
          再読み込み
        </button>
      </div>
    );
  }

  if (!data || !isRuleSessionData(data)) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        ルール作成セッションが見つかりません。
      </div>
    );
  }

  const {
    session,
    questions,
    answers,
    latestReview,
    qualityChecks,
    latestFinancialStatement,
  } = data;
  const agentAnswers = answers.filter((answer) => hasAgentOrigin(answer.answer_json));

  const pendingQuestion = questions?.find(
    (question) => question.status === "pending",
  );
  const completedQuestionCount = questions.filter(
    (question) => question.status === "answered" || question.status === "skipped",
  ).length;
  const questionProgress = questions.length
    ? Math.round((completedQuestionCount / questions.length) * 100)
    : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            {session.ticker}
            {session.company_name ? ` / ${session.company_name}` : ""}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            質問に答えながら、保有理由・見直し条件・最大投資比率を整理します。
          </p>
          <div className="mt-4" aria-label="質問の進捗">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>進捗</span>
              <span>
                {completedQuestionCount} / {questions.length}問
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-black transition-all"
                style={{ width: `${questionProgress}%` }}
              />
            </div>
          </div>
        </div>

        {agentAnswers.length > 0 ? (
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-4" aria-label="外部エージェント入力の確認">
            <h2 className="font-semibold">外部エージェントが入力した回答があります</h2>
            <p className="mt-1 text-sm">完成保存の前に、次の回答を本人が確認してください。</p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {agentAnswers.map((answer) => <li key={answer.question_key}>{answer.question_key}</li>)}
            </ul>
          </section>
        ) : null}

        {pendingQuestion ? (
          <QuestionCard
            sessionId={sessionId}
            question={pendingQuestion}
            onSaved={() => void reload()}
          />
        ) : (
          <div className="rounded-lg border p-6">
            <h2 className="font-semibold">質問はすべて回答済みです</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              AIレビューを実行して、不足項目や改善点を確認しましょう。
            </p>
          </div>
        )}

        <ReviewActionBar
          sessionId={sessionId}
          onReviewed={() => void reload()}
        />

        <RuleReviewPanel review={latestReview} qualityChecks={qualityChecks} />
      </section>

      <aside className="space-y-6">
        <RuleDraftView ruleJson={session.rule_json} />

        <FinancialStatementCard statement={latestFinancialStatement ?? null} />

        <FinalizeRuleButton
          sessionId={sessionId}
          completionScore={session.completion_score}
          canFinalize={latestReview?.can_finalize ?? false}
          onFinalized={() => void reload()}
        />
      </aside>
    </div>
  );
}

function hasAgentOrigin(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    (value as { enteredBy?: unknown }).enteredBy === "api_agent";
}
