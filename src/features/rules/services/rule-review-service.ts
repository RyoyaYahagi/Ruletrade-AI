import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { getAiDeveloperSettings } from "@/features/ai/services/ai-developer-settings-service";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import { AppError } from "@/lib/errors/app-error";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { buildRuleReviewSafetyText } from "@/lib/safety/safety-text";
import { withAiRunLogging } from "@/lib/ai/logs/with-ai-run-logging";
import { updateAiRunLog } from "@/lib/ai/logs/update-ai-run-log";
import { logAiRunEvent } from "@/lib/ai/logs/log-ai-run-event";
import { retrieveRagContext } from "@/features/rag/services/retrieve-rag-context";
import { zeroAIUsage } from "@/lib/ai/usage/token-usage";
import {
  buildQuestionsFromQualityChecks,
  selectNewReviewQuestions,
  type ReviewNextQuestionCandidate,
} from "@/features/rules/services/rule-review-question-selection";
import { getPortfolioCommonRule } from "@/features/portfolio/services/portfolio-rule-service";
import { TradeRuleSchema } from "@/schemas/rules/trade-rule-schema";
import { buildMonitoringQualityChecks } from "@/features/rules/services/trading-rule-validation";
import {
  buildCommonRuleContextText,
  filterQuestionsCoveredByCommonRule,
  getCoveredRuleFields,
} from "@/features/rules/services/common-rule-context";

function mapQuestionType(type: string): string {
  if (type === "multi_choice") return "multiple_choice";
  return type;
}

const RULE_REVIEW_JSON_FORMAT = `
Return only one JSON object. Do not wrap it in markdown or add commentary.
The JSON object must have exactly this shape:
{
  "summary": "string",
  "completionScore": 0,
  "needsMoreInfo": true,
  "canFinalize": false,
  "qualityChecks": [
    {
      "checkKey": "string",
      "label": "string",
      "status": "pass | warning | fail",
      "severity": "low | medium | high",
      "reason": "string",
      "suggestedQuestion": "string, optional"
    }
  ],
  "nextQuestions": [
    {
      "questionKey": "string",
      "questionText": "string",
      "questionType": "multi_choice | single_choice | free_text",
      "options": [
        { "value": "string", "label": "string" }
      ],
      "priority": 1,
      "isRequired": true,
      "mapsToRuleField": "string, optional",
      "source": "ai",
      "status": "pending",
      "displayOrder": 0,
      "helpText": "string, optional"
    }
  ],
  "suggestedRuleUpdates": [],
  "safety": {
    "passed": true,
    "riskLevel": "low",
    "violations": [],
    "prohibitedPhrasesDetected": []
  }
}
Rules:
- completionScore must be a number from 0 to 100.
- canFinalize must be false when important information is missing.
- nextQuestions can be [] when no more information is needed.
- Prefer multi_choice when more than one option could fit the user's thinking. Use single_choice only when choices are mutually exclusive. Avoid free_text unless choices would be misleading.
- For every single_choice or multi_choice question, include 3 to 5 options.
- Include an option such as "まだ決めていない" or "候補を提案してほしい" when the user may not know the answer yet.
- Do not recommend buying, selling, timing, target returns, or price predictions.
`.trim();

function buildRuleReviewFallback(params: {
  ticker: string;
  companyName: string;
}): {
  data: import("@/schemas/rules/rule-review-schema").RuleReviewOutput;
  rawText: string;
  usage: typeof zeroAIUsage;
  meta: {
    provider: string;
    model: string;
    taskType: "rule_review";
    promptVersion: string;
    fallbackUsed: true;
    latencyMs: number;
  };
} {
  const startedAt = Date.now();

  return {
    data: {
      summary: `${params.companyName}（${params.ticker}）のルールは保存されています。AIプロバイダが一時的に混雑しているため、未決定項目を整理するための代替レビューを表示します。`,
      completionScore: 50,
      needsMoreInfo: true,
      canFinalize: false,
      qualityChecks: [
        {
          checkKey: "entry_exit_specificity",
          label: "エントリー・出口条件",
          status: "warning" as const,
          severity: "medium" as const,
          reason:
            "買い増しや撤退の条件は、あとで迷わない程度に具体化しておくと振り返りやすくなります。",
          suggestedQuestion:
            "どの条件を満たしたら買い増し・見直しを検討しますか？",
        },
        {
          checkKey: "risk_management_specificity",
          label: "リスク管理",
          status: "warning" as const,
          severity: "medium" as const,
          reason:
            "最大投資比率や見直し条件が曖昧だと、保有後の判断がぶれやすくなります。",
          suggestedQuestion:
            "この銘柄への投資額はポートフォリオ全体のどの程度までにしますか？",
        },
      ],
      nextQuestions: [
        {
          questionKey: "fallback_entry_conditions",
          questionText: "買い増しや新規購入を検討する条件はどれに近いですか？",
          questionType: "multi_choice" as const,
          options: [
            { value: "price_drop", label: "大きく下落したら検討" },
            {
              value: "earnings_confirmed",
              label: "決算や業績を確認してから検討",
            },
            { value: "undecided", label: "まだ決めていない" },
            { value: "ask_ai", label: "候補を提案してほしい" },
          ],
          priority: 4,
          isRequired: true,
          mapsToRuleField: "entryPlan.entryConditions",
          source: "ai" as const,
          status: "pending" as const,
          displayOrder: 0,
          helpText: "複数選択できます。未決定でも問題ありません。",
        },
        {
          questionKey: "fallback_risk_management",
          questionText: "リスク管理で決めておきたいことはどれですか？",
          questionType: "multi_choice" as const,
          options: [
            { value: "max_position", label: "最大投資比率" },
            { value: "review_condition", label: "見直し条件" },
            { value: "loss_limit", label: "損失が出たときの対応" },
            { value: "undecided", label: "まだ決めていない" },
            { value: "ask_ai", label: "候補を提案してほしい" },
          ],
          priority: 3,
          isRequired: true,
          mapsToRuleField: "riskManagement",
          source: "ai" as const,
          status: "pending" as const,
          displayOrder: 1,
          helpText: "あとで具体化する項目を選ぶだけで大丈夫です。",
        },
      ],
      suggestedRuleUpdates: [],
      safety: {
        passed: true,
        riskLevel: "low" as const,
        violations: [],
        prohibitedPhrasesDetected: [],
      },
    },
    rawText: "",
    usage: zeroAIUsage,
    meta: {
      provider: "local_fallback",
      model: "rule-review-fallback",
      taskType: "rule_review",
      promptVersion: "rule-reviewer-v1",
      fallbackUsed: true,
      latencyMs: Date.now() - startedAt,
    },
  };
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
  const db = await createDatabaseClient();

  const { error } = await db.from("rule_reviews").insert({
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
  requestId?: string;
}) {
  const db = await createDatabaseClient();
  const { data: session, error: sessionError } = await db
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

  const aiSettings = await getAiDeveloperSettings({ userId: params.userId });
  const ai = getAIProvider(aiSettings);
  const { RuleReviewSchema } =
    await import("@/schemas/rules/rule-review-schema");

  const { rule: commonRule } = await getPortfolioCommonRule({
    userId: params.userId,
  });
  const commonRuleContextText = buildCommonRuleContextText(commonRule);
  const coveredRuleFields = getCoveredRuleFields(commonRule);

  const ragQueryText = JSON.stringify({
    task: "rule_review",
    ticker: session.ticker,
    companyName: session.company_name,
    rule: session.rule_json,
  });

  const ragContext = await retrieveRagContext({
    userId: params.userId,
    requestId: params.requestId,
    taskType: "rule_review",
    queryText: ragQueryText,
    sourceTypes: [
      "investor_profile",
      "rule_session",
      "rule_review",
      "watchlist_item",
      "portfolio_position",
    ],
    matchThreshold: 0.72,
    matchCount: 8,
  });

  const aiResult = await withAiRunLogging<
    import("@/schemas/rules/rule-review-schema").RuleReviewOutput
  >({
    userId: params.userId,
    taskType: "rule_review",
    sourceType: "rule_session",
    sourceId: params.sessionId,
    sessionId: params.sessionId,
    provider: aiSettings.provider,
    model: aiSettings.model,
    promptVersion: "rule-reviewer-v1",
    inputJson: {
      ticker: session.ticker,
      companyName: session.company_name,
      rule: session.rule_json,
      portfolioCommonRules: commonRuleContextText,
      ragContext: ragContext.contextText,
    },
    run: async () => {
      try {
        return await ai.generateObject({
          taskType: "rule_review",
          schema: RuleReviewSchema,
          schemaName: "RuleReview",
          promptVersion: "rule-reviewer-v1",
          messages: [
            {
              role: "system",
              content: [
                "あなたは投資ルール設計を支援するAIです。買い推奨・売り推奨はせず、抜け漏れ確認と追加質問を行います。RAG Contextは参考情報であり、矛盾があれば現在のユーザー入力を優先してください。",
                "portfolioCommonRulesが与えられている場合、そこで既に決まっている項目（最大保有比率、許容損失、現金比率、目標配分など）は銘柄別ルールで重複して質問しないでください。銘柄固有の事情で共通ルールより厳しくする必要があるときだけ質問し、qualityChecksでも共通ルールでカバー済みの項目はpass扱いにしてください。",
                RULE_REVIEW_JSON_FORMAT,
              ].join("\n\n"),
            },
            {
              role: "user",
              content: JSON.stringify({
                currentRuleSession: {
                  ticker: session.ticker,
                  companyName: session.company_name,
                  rule: session.rule_json,
                },
                portfolioCommonRules: commonRuleContextText,
                ragContext: ragContext.contextText,
              }),
            },
          ],
        });
      } catch (error) {
        if (error instanceof AIProviderError && error.retryable) {
          return buildRuleReviewFallback({
            ticker: session.ticker,
            companyName: session.company_name,
          });
        }

        throw error;
      }
    },
  });

  const parsedTradeRule = TradeRuleSchema.safeParse(session.rule_json ?? {});
  const deterministicQualityChecks = parsedTradeRule.success
    ? buildMonitoringQualityChecks(parsedTradeRule.data)
    : [];
  const hasMonitoringBlocker = deterministicQualityChecks.some(
    (check) => check.status === "fail",
  );
  const review = {
    ...aiResult.data,
    qualityChecks: [
      ...aiResult.data.qualityChecks,
      ...deterministicQualityChecks,
    ],
    needsMoreInfo:
      aiResult.data.needsMoreInfo || deterministicQualityChecks.length > 0,
    canFinalize: aiResult.data.canFinalize && !hasMonitoringBlocker,
  };

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

  const { data: savedReview, error: reviewError } = await db
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
    const { error: checksError } = await db
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

  const { data: existingQuestions, error: existingQuestionsError } =
    await db
      .from("rule_questions")
      .select("question_key, question_text, status")
      .eq("session_id", params.sessionId)
      .eq("user_id", params.userId);
  if (existingQuestionsError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "既存質問の確認に失敗しました。",
      500,
      existingQuestionsError,
    );
  }

  const existingQuestionList = (existingQuestions ?? []) as Array<{
    question_key: string;
    question_text: string;
    status: string;
  }>;
  const maxQuestionCount = Number(session.max_question_count ?? 12);
  const reviewQuestionCandidates = filterQuestionsCoveredByCommonRule(
    [
      ...(review.nextQuestions as ReviewNextQuestionCandidate[]),
      ...buildQuestionsFromQualityChecks(review.qualityChecks),
    ],
    coveredRuleFields,
  );
  const questionsToInsert = selectNewReviewQuestions({
    nextQuestions: reviewQuestionCandidates,
    existingQuestions: existingQuestionList,
    maxQuestionCount,
  });

  if (questionsToInsert.length > 0) {
    const { error: questionsError } = await db
      .from("rule_questions")
      .insert(
        questionsToInsert.map((question, index: number) => ({
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
        })),
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
  const { error: updateError } = await db
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
    nextQuestions: questionsToInsert,
    estimatedCostUsd: aiResult.usage?.estimatedCostUsd ?? 0,
  };
}
