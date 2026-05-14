import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { AppError } from "@/lib/errors/app-error";

function mapQuestionType(type: string): string {
  if (type === "multi_choice") return "multiple_choice";
  return type;
}

export async function runRuleReview(params: { userId: string; sessionId: string }) {
  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase
    .from("rule_design_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();
  if (sessionError || !session) {
    throw new AppError("NOT_FOUND", "ルール作成セッションが見つかりません。", 404);
  }

  const ai = getAIProvider();
  const { RuleReviewSchema } = await import("@/schemas/rules/rule-review-schema");
  const aiResult = await ai.generateObject({
    taskType: "rule_review",
    schema: RuleReviewSchema,
    schemaName: "RuleReview",
    promptVersion: "rule-reviewer-v1",
    messages: [
      {
        role: "system",
        content:
          "あなたは投資ルール設計を支援するAIです。買い推奨・売り推奨はせず、抜け漏れ確認と追加質問を行います。",
      },
      {
        role: "user",
        content: JSON.stringify({
          ticker: session.ticker,
          companyName: session.company_name,
          rule: session.rule_json,
        }),
      },
    ],
  });

  const review = aiResult.data;

  const { data: savedReview, error: reviewError } = await supabase
    .from("rule_reviews")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      provider: aiResult.meta.provider,
      model: aiResult.meta.model,
      prompt_version: aiResult.meta.promptVersion ?? "unknown",
      review_json: review,
      summary: review.summary,
      completion_score: review.completionScore,
      needs_more_info: review.needsMoreInfo,
      can_finalize: review.canFinalize,
      safety_passed: review.safety?.passed ?? true,
      schema_valid: true,
      input_tokens: aiResult.usage.inputTokens ?? null,
      output_tokens: aiResult.usage.outputTokens ?? null,
      estimated_cost_usd: aiResult.usage.estimatedCostUsd ?? null,
      latency_ms: aiResult.meta.latencyMs,
    })
    .select("id")
    .single();
  if (reviewError || !savedReview) {
    throw new AppError("INTERNAL_ERROR", "AIレビュー結果の保存に失敗しました。", 500, reviewError);
  }

  if (review.qualityChecks.length > 0) {
    await supabase.from("rule_quality_checks").insert(
      review.qualityChecks.map(
        (check: {
          checkKey: string;
          label: string;
          status: string;
          severity: string;
          reason: string;
          suggestedQuestion?: string;
        }) => ({
          user_id: params.userId,
          session_id: params.sessionId,
          review_id: savedReview.id,
          check_key: check.checkKey,
          label: check.label,
          status: check.status,
          severity: check.severity,
          reason: check.reason,
          suggested_question: check.suggestedQuestion ?? null,
        }),
      ),
    );
  }

  if (review.nextQuestions.length > 0) {
    await supabase.from("rule_questions").insert(
      review.nextQuestions.map(
        (
          question: {
            questionKey: string;
            questionText: string;
            questionType: string;
            options?: unknown;
            helpText?: string;
            priority: number;
            isRequired: boolean;
            mapsToRuleField?: string;
          },
          index: number,
        ) => ({
          user_id: params.userId,
          session_id: params.sessionId,
          question_key: question.questionKey,
          question_text: question.questionText,
          question_type: mapQuestionType(question.questionType),
          options: question.options ?? null,
          help_text: question.helpText ?? null,
          priority: question.priority,
          is_required: question.isRequired,
          maps_to_rule_field: question.mapsToRuleField ?? null,
          source: "ai",
          status: "pending",
          display_order: 100 + index,
        }),
      ),
    );
  }

  const nextStatus = review.canFinalize ? "quality_gate_passed" : "needs_more_info";
  await supabase
    .from("rule_design_sessions")
    .update({
      completion_score: review.completionScore,
      quality_gate_status: review.canFinalize ? "passed" : "needs_more_info",
      status: nextStatus,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId);

  return {
    reviewId: savedReview.id,
    completionScore: review.completionScore,
    needsMoreInfo: review.needsMoreInfo,
    canFinalize: review.canFinalize,
    nextQuestions: review.nextQuestions,
  };
}
