import { CompletionScoreCard } from "@/features/rules/components/completion-score-card";
import { QualityChecksList } from "@/features/rules/components/quality-checks-list";

export function RuleReviewPanel({
  review,
  qualityChecks,
}: {
  review: {
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
}) {
  if (!review) {
    return (
      <section className="rounded-lg border p-6">
        <h2 className="font-semibold">レビュー結果</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          まだAIレビューは実行されていません。
        </p>
      </section>
    );
  }

  if (review.safety_passed === false) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-900">
          レビューを表示できません
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          AI出力に安全性の問題があったため、本文の表示を停止しました。
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border p-6">
      <h2 className="text-lg font-semibold">レビュー結果</h2>

      <CompletionScoreCard score={review.completion_score} />

      {review.summary ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Summary</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{review.summary}</p>
        </div>
      ) : null}

      <QualityChecksList qualityChecks={qualityChecks} />
    </section>
  );
}
