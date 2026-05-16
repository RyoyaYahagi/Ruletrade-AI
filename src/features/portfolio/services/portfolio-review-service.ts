import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { PortfolioReviewSchema } from "@/schemas/portfolio/portfolio-review-schema";
import { calculatePortfolioSummary } from "@/features/portfolio/services/portfolio-aggregation-service";
import {
  buildPortfolioReviewPrompt,
  PORTFOLIO_REVIEW_PROMPT_VERSION,
} from "@/features/portfolio/prompts/portfolio-review-prompt";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { AppError } from "@/lib/errors/app-error";

export async function runPortfolioReview(params: {
  userId: string;
  requestId?: string;
}) {
  const supabase = await createClient();

  const { data: portfolio, error: portfolioError } = await supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .single();

  if (portfolioError || !portfolio) {
    throw new AppError("NOT_FOUND", "ポートフォリオが見つかりません。", 404);
  }

  const { data: positions, error: positionsError } = await supabase
    .from("portfolio_positions")
    .select("*")
    .eq("user_id", params.userId)
    .eq("portfolio_id", portfolio.id)
    .neq("position_status", "archived")
    .order("market_value", {
      ascending: false,
    });

  if (positionsError) {
    throw positionsError;
  }

  const summary = calculatePortfolioSummary({
    cashAmount: Number(portfolio.cash_amount ?? 0),
    positions: positions ?? [],
  });

  const prompt = buildPortfolioReviewPrompt({
    portfolio,
    positions: positions ?? [],
    summary,
  });

  const ai = getAIProvider();

  const aiResult = await ai.generateObject({
    taskType: "portfolio_review",
    schema: PortfolioReviewSchema,
    schemaName: "PortfolioReview",
    promptVersion: PORTFOLIO_REVIEW_PROMPT_VERSION,
    messages: [
      {
        role: "system",
        content: prompt.system,
      },
      {
        role: "user",
        content: prompt.user,
      },
    ],
  });

  const review = aiResult.data;

  const safetyText = [
    review.summary,
    ...review.qualityChecks.map((check) => check.reason),
    ...review.followUpQuestions.map((question) => question.questionText),
  ].join("\n");

  const safety = runSafetyCheck({
    text: safetyText,
  });

  const reviewWithSafety = {
    ...review,
    safety,
  };

  const { data: savedReview, error: reviewError } = await supabase
    .from("portfolio_reviews")
    .insert({
      user_id: params.userId,
      portfolio_id: portfolio.id,
      provider: aiResult.meta.provider,
      model: aiResult.meta.model,
      prompt_version:
        aiResult.meta.promptVersion ?? PORTFOLIO_REVIEW_PROMPT_VERSION,
      review_json: reviewWithSafety,
      summary: safety.passed ? review.summary : null,
      risk_score: safety.passed ? review.riskScore : null,
      diversification_score: safety.passed ? review.diversificationScore : null,
      rule_coverage_score: safety.passed ? review.ruleCoverageScore : null,
      needs_more_info: review.needsMoreInfo,
      safety_passed: safety.passed,
      schema_valid: true,
      input_tokens: aiResult.usage.inputTokens ?? null,
      output_tokens: aiResult.usage.outputTokens ?? null,
      estimated_cost_usd: aiResult.usage.estimatedCostUsd ?? null,
      latency_ms: aiResult.meta.latencyMs,
      error_message: safety.passed ? null : "SAFETY_FAILED",
    })
    .select("id")
    .single();

  if (reviewError || !savedReview) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ポートフォリオレビューの保存に失敗しました。",
      500,
      reviewError,
    );
  }

  if (!safety.passed) {
    throw new AppError(
      "SAFETY_FAILED",
      "AI出力に安全性の問題があったため、表示できません。",
      422,
      {
        safety,
      },
      false,
    );
  }

  if (review.qualityChecks.length > 0) {
    const { error: checksError } = await supabase
      .from("portfolio_quality_checks")
      .insert(
        review.qualityChecks.map((check) => ({
          user_id: params.userId,
          portfolio_id: portfolio.id,
          review_id: savedReview.id,
          check_key: check.checkKey,
          label: check.label,
          status: check.status,
          severity: check.severity,
          reason: check.reason,
          related_tickers: check.relatedTickers,
          suggested_question: check.suggestedQuestion ?? null,
        })),
      );

    if (checksError) {
      throw checksError;
    }
  }

  return {
    reviewId: savedReview.id,
    summary: review.summary,
    riskScore: review.riskScore,
    diversificationScore: review.diversificationScore,
    ruleCoverageScore: review.ruleCoverageScore,
    qualityChecks: review.qualityChecks,
    followUpQuestions: review.followUpQuestions,
    suggestedRuleSessionTargets: review.suggestedRuleSessionTargets,
  };
}
