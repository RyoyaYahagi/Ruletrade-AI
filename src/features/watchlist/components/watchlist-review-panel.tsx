"use client";

import { useState } from "react";

type QualityCheck = {
  checkKey: string;
  label: string;
  status: string;
  reason: string;
  relatedTickers?: string[];
};

type ReviewData = {
  readinessScore: number;
  summary: string;
  qualityChecks: QualityCheck[];
  followUpQuestions: { questionText: string }[];
  suggestedRuleSessionTargets: { ticker: string; reason: string }[];
};

export function WatchlistReviewPanel({
  onReviewComplete,
}: {
  onReviewComplete?: () => void;
}) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleReview() {
    setIsReviewing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/watchlist/review", { method: "POST" });
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(
          json.error?.message ?? "Watchlistレビューに失敗しました。",
        );
        return;
      }

      setReview(json.data);
      onReviewComplete?.();
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <section className="rounded-lg border p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">AI Watchlistレビュー</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            購入候補の抜け漏れ、未設定ルール、Rule
            Session化できる候補を確認します。
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleReview()}
          disabled={isReviewing}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isReviewing ? "レビュー中..." : "レビュー実行"}
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {review ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-muted-foreground">準備度スコア</p>
            <p className="mt-1 text-2xl font-bold">
              {review.readinessScore}/100
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Summary</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{review.summary}</p>
          </div>

          <div className="space-y-3">
            {review.qualityChecks?.map((check: QualityCheck) => (
              <div key={check.checkKey} className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{check.label}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                    {check.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {check.reason}
                </p>
                {check.relatedTickers != null &&
                check.relatedTickers.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    関連銘柄: {check.relatedTickers.join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
