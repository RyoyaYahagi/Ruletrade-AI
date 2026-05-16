import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { AppError } from "@/lib/errors/app-error";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { buildRuleReviewSafetyText } from "@/lib/safety/safety-text";
import { withAiRunLogging } from "@/lib/ai/logs/with-ai-run-logging";
import { updateAiRunLog } from "@/lib/ai/logs/update-ai-run-log";
import { logAiRunEvent } from "@/lib/ai/logs/log-ai-run-event";
import {
  getConfiguredAIProvider,
  getOpenAIModel,
  getGeminiModel,
} from "@/lib/ai/model-config";

function mapQuestionType(type: string): string {
  if (type === "multi_choice") return "multiple_choice";
  return type;
}

function getConfiguredModelForLog(): string {
  const provider = getConfiguredAIProvider();
  if (provider === "openai") return getOpenAIModel();
  if (provider === "gemini") return getGeminiModel();
  return "mock-model";
}

async function saveUnsafeRuleReview(params: {
  userId: string;
  sessionId: string;
  aiRunLogId: string;
  aiResult: {
    meta: {
      provider: string;
      model: string;
      promptVersion?: string;
      latencyMs: number;
    };
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      estimatedCostUsd?: number;
    };
  };
  review: unknown;
  safety: unknown;
}) {
  const supabase = await createServerClient();

  const { error } = await supabase.from("rule_reviews").insert({
    user_id: params.userId,
    session_id: params.sessionId,
    ai_run_log_id: params.aiRunLogId,
    provider: params.aiResult.meta.provider,
    model: params.aiResult.meta.model,
    prompt_version: params.aiResult.meta.promptVersion ?? "unknown",
    review_json: params.review,
    summary: null,
    completion_score: null,
    needs_more_info: true,
    can_finalize: false,
    safety_passed: false,
    schema_valid: true,
    input_tokens: params.aiResult.usage.inputTokens ?? null,
    output_tokens: params.aiResult.usage.outputTokens ?? null,
    estimated_cost_usd: params.aiResult.usage.estimatedCostUsd ?? null,
    latency_ms: params.aiResult.meta.latencyMs,
    error_message: "SAFETY_FAILED",
  });
  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "安全性チェック不合格レビューの保存に失敗しました。",
      500,
      error,
    );
  }
}

export async function runRuleReview(params: {
  userId: string;
  sessionId: string;
}) {
  const supabase = await createServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("rule_design_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();
  if (sessionError || !session) {
    throw new AppError(
      "NOT_FOUND",
      "ルール作成セッションが見つかりません。",
      404,
    );
  }

  const ai = getAIProvider();
  const { RuleReviewSchema } =
    await import("@/schemas/rules/rule-review-schema");

  const aiResult = await withAiRunLogging({
    userId: params.userId,
    taskType: "rule_review",
    sourceType: "rule_session",
    sourceId: params.sessionId,
    sessionId: params.sessionId,
    provider: getConfiguredAIProvider(),
    model: getConfiguredModelForLog(),
    promptVersion: "rule-reviewer-v1",
    inputJson: {
      ticker: session.ticker,
      companyName: session.company_name,
      rule: session.rule_json,
    },
    run: () =>
      ai.generateObject({
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
      }),
  });

  const review = aiResult.data;

  const safetyText = buildRuleReviewSafetyText(review);

  const safety = runSafetyCheck({
    text: safetyText,
  });

  const reviewWithSafety = {
    ...review,
    safety,
  };

  if (!safety.passed) {
    await updateAiRunLog({
      aiRunLogId: aiResult.aiRunLogId,
      userId: params.userId,
      status: "failed",
      schemaValid: true,
      safetyPassed: false,
      errorCode: "SAFETY_FAILED",
      errorMessage: "AI output failed safety check.",
      errorDetails: {
        safety,
      },
    });

    await logAiRunEvent({
      aiRunLogId: aiResult.aiRunLogId,
      userId: params.userId,
      eventType: "safety_failed",
      message: "AI output failed safety check.",
      metadata: { safety },
    });

    await saveUnsafeRuleReview({
      userId: params.userId,
      sessionId: params.sessionId,
      aiRunLogId: aiResult.aiRunLogId,
      aiResult,
      review: reviewWithSafety,
      safety,
    });

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

  const { data: savedReview, error: reviewError } = await supabase
    .from("rule_reviews")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      ai_run_log_id: aiResult.aiRunLogId,
      provider: aiResult.meta.provider,
      model: aiResult.meta.model,
      prompt_version: aiResult.meta.promptVersion ?? "unknown",
      review_json: reviewWithSafety,
      summary: review.summary,
      completion_score: review.completionScore,
      needs_more_info: review.needsMoreInfo,
      can_finalize: review.canFinalize,
      safety_passed: safety.passed,
      schema_valid: true,
      input_tokens: aiResult.usage.inputTokens ?? null,
      output_tokens: aiResult.usage.outputTokens ?? null,
      estimated_cost_usd: aiResult.usage.estimatedCostUsd ?? null,
      latency_ms: aiResult.meta.latencyMs,
    })
    .select("id")
    .single();
  if (reviewError || !savedReview) {
    throw new AppError(
      "INTERNAL_ERROR",
      "AIレビュー結果の保存に失敗しました。",
      500,
      reviewError,
    );
  }

  if (review.qualityChecks.length > 0) {
    const { error: checksError } = await supabase
      .from("rule_quality_checks")
      .insert(
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
    if (checksError) {
      throw new AppError(
        "INTERNAL_ERROR",
        "品質チェックの保存に失敗しました。",
        500,
        checksError,
      );
    }
  }

  if (review.nextQuestions.length > 0) {
    const { error: questionsError } = await supabase
      .from("rule_questions")
      .insert(
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
    if (questionsError) {
      throw new AppError(
        "INTERNAL_ERROR",
        "次の質問の保存に失敗しました。",
        500,
        questionsError,
      );
    }
  }

  const nextStatus = review.canFinalize
    ? "quality_gate_passed"
    : "needs_more_info";
  const { error: updateError } = await supabase
    .from("rule_design_sessions")
    .update({
      completion_score: review.completionScore,
      quality_gate_status: review.canFinalize ? "passed" : "needs_more_info",
      status: nextStatus,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId);
  if (updateError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "セッションの更新に失敗しました。",
      500,
      updateError,
    );
  }

  return {
    reviewId: savedReview.id,
    completionScore: review.completionScore,
    needsMoreInfo: review.needsMoreInfo,
    canFinalize: review.canFinalize,
    nextQuestions: review.nextQuestions,
    estimatedCostUsd: aiResult.usage?.estimatedCostUsd ?? 0,
  };
}
