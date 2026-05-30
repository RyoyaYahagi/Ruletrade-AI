"use client";

import { useState } from "react";

type ReviewResult = {
  reviewId: string;
  summary: string;
  readinessScore: number;
  needsMoreInfo: boolean;
  canCreateRuleSession: boolean;
  qualityChecks: unknown[];
  followUpQuestions: unknown[];
  suggestedRuleSessionTargets: unknown[];
};

export function useRunWatchlistReview() {
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runReview(itemId?: string) {
    setIsReviewing(true);
    setError(null);
    setReview(null);

    try {
      const url = itemId
        ? `/api/watchlist/items/${itemId}/review`
        : "/api/watchlist/review";

      const response = await fetch(url, { method: "POST" });
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setError(json.error?.message ?? "Watchlistレビューに失敗しました。");
        return;
      }

      setReview(json.data as ReviewResult);
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setIsReviewing(false);
    }
  }

  return { review, isReviewing, error, runReview };
}
