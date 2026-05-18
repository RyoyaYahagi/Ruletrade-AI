import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { WatchlistReviewSchema } from "@/schemas/watchlist/watchlist-review-schema";
import {
  buildWatchlistReviewPrompt,
  WATCHLIST_REVIEW_PROMPT_VERSION,
} from "@/features/watchlist/prompts/watchlist-review-prompt";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { AppError } from "@/lib/errors/app-error";

export async function runWatchlistReview(params: {
  userId: string;
  itemId?: string;
  requestId?: string;
}) {
  const supabase = await createServerClient();

  const { data: watchlist, error: watchlistError } = await supabase
    .from("watchlists")
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (watchlistError || !watchlist) {
    throw new AppError("NOT_FOUND", "Watchlistが見つかりません。", 404);
  }

  let query = supabase
    .from("watchlist_items")
    .select("*")
    .eq("user_id", params.userId)
    .eq("watchlist_id", watchlist.id)
    .neq("status", "archived");

  if (params.itemId) {
    query = query.eq("id", params.itemId);
  }

  const { data: items, error: itemsError } = await query.order("updated_at", {
    ascending: false,
  });

  if (itemsError) {
    throw itemsError;
  }

  if (!items || items.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "レビュー対象のWatchlist itemがありません。",
      400,
    );
  }

  const scope = params.itemId ? "item" : "watchlist";

  const prompt = buildWatchlistReviewPrompt({
    watchlist,
    items,
    scope,
  });

  const ai = getAIProvider();

  const aiResult = await ai.generateObject({
    taskType: "watchlist_review",
    schema: WatchlistReviewSchema,
    schemaName: "WatchlistReview",
    promptVersion: WATCHLIST_REVIEW_PROMPT_VERSION,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
  });

  const review = aiResult.data;

  const safetyText = [
    review.summary,
    ...review.qualityChecks.map((check) => check.reason),
    ...review.followUpQuestions.map((question) => question.questionText),
  ].join("\n");

  const safety = runSafetyCheck({ text: safetyText });

  const reviewWithSafety = { ...review, safety };

  const { data: savedReview, error: reviewError } = await supabase
    .from("watchlist_reviews")
    .insert({
      user_id: params.userId,
      watchlist_id: watchlist.id,
      item_id: params.itemId ?? null,
      review_scope: scope,
      provider: aiResult.meta.provider,
      model: aiResult.meta.model,
      prompt_version:
        aiResult.meta.promptVersion ?? WATCHLIST_REVIEW_PROMPT_VERSION,
      review_json: reviewWithSafety,
      summary: safety.passed ? review.summary : null,
      readiness_score: safety.passed ? review.readinessScore : null,
      needs_more_info: review.needsMoreInfo,
      can_create_rule_session: review.canCreateRuleSession,
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
      "Watchlistレビューの保存に失敗しました。",
      500,
      reviewError,
    );
  }

  await supabase
    .from("watchlist_items")
    .update({ last_reviewed_at: new Date().toISOString() })
    .eq("user_id", params.userId)
    .in(
      "id",
      items.map((item) => item.id),
    );

  if (!safety.passed) {
    throw new AppError(
      "SAFETY_FAILED",
      "AI出力に安全性の問題があったため、表示できません。",
      422,
      { safety },
      false,
    );
  }

  if (review.qualityChecks.length > 0) {
    const { error: checksError } = await supabase
      .from("watchlist_quality_checks")
      .insert(
        review.qualityChecks.map((check) => ({
          user_id: params.userId,
          watchlist_id: watchlist.id,
          item_id: params.itemId ?? null,
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
    readinessScore: review.readinessScore,
    needsMoreInfo: review.needsMoreInfo,
    canCreateRuleSession: review.canCreateRuleSession,
    qualityChecks: review.qualityChecks,
    followUpQuestions: review.followUpQuestions,
    suggestedRuleSessionTargets: review.suggestedRuleSessionTargets,
  };
}
