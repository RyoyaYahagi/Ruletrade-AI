"use client";

import { useState } from "react";

export type PortfolioReviewResult = {
  reviewId: string;
  summary: string;
  riskScore: number;
  diversificationScore: number;
  ruleCoverageScore: number;
  qualityChecks: Array<{
    checkKey: string;
    label: string;
    status: string;
    severity: string;
    reason: string;
    relatedTickers: string[];
    suggestedQuestion?: string;
  }>;
  followUpQuestions: Array<{
    questionKey: string;
    questionText: string;
    relatedTickers: string[];
  }>;
};

export function useRunPortfolioReview() {
  const [review, setReview] = useState<PortfolioReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function runReview() {
    setIsReviewing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/portfolio/review", {
        method: "POST",
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(
          json.error?.message ?? "ポートフォリオレビューに失敗しました。",
        );
        return;
      }

      setReview(json.data);
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsReviewing(false);
    }
  }

  return {
    review,
    isReviewing,
    errorMessage,
    runReview,
  };
}
