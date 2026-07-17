import "server-only";

import { z } from "zod";
import { callAi } from "@/lib/ai/provider-gateway";
import { AppError } from "@/lib/errors/app-error";
import { runMeteredAiCall } from "@/lib/cost-limit/run-metered-ai-call";
import { ESTIMATED_AI_COST_USD } from "@/lib/cost-limit/cost-limit-types";
import { createDatabaseClient } from "@/lib/db/database-client";
import { retrieveRagContext } from "@/features/rag/services/retrieve-rag-context";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { runComplianceGate } from "@/features/legal/services/compliance-gate-service";
import {
  FALLBACK_BREAKER_CANDIDATES,
} from "@/features/rules/constants/question-catalog";
import {
  buildThesisDraftPrompt,
  THESIS_DRAFT_SYSTEM_PROMPT,
} from "@/features/rules/prompts/thesis-draft-prompt";

const ThesisDraftOutputSchema = z.object({
  thesis: z.string().min(1).max(400),
  breakers: z
    .array(
      z.object({
        description: z.string().min(1).max(200),
        newsKeywords: z.array(z.string().min(1).max(50)).max(5),
      }),
    )
    .length(4),
});

export async function generateThesisDraft(params: {
  userId: string;
  sessionId: string;
}): Promise<{
  thesisDraft: string;
  breakerCandidates: Array<{
    description: string;
    newsKeywords: string[];
  }>;
}> {
  const db = await createDatabaseClient();
  const { data: session, error: sessionError } = await db
    .from("rule_design_sessions")
    .select("id, ticker, company_name")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();

  if (sessionError || !session) {
    throw new AppError("NOT_FOUND", "ルール作成セッションが見つかりません。", 404);
  }

  const { data: answers, error: answersError } = await db
    .from("rule_answers")
    .select("question_key, answer_text, answer_json")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .in("question_key", ["holding_purpose", "time_horizon", "thesis_seed"])
    .order("created_at", { ascending: true });

  if (answersError) {
    throw new AppError(
      "DATABASE_ERROR",
      "仮説の材料を取得できませんでした。",
      500,
      answersError,
    );
  }

  // 新規ユーザーの検索0件は正常系。過去の自分のメモがない状態でも、
  // 現在の回答だけで通常どおり下書きを生成する。
  const ragResult = await retrieveRagContext({
    userId: params.userId,
    taskType: "rule_draft_generation",
    queryText: `${session.ticker} ${session.company_name ?? ""} 投資仮説`,
    sourceTypes: ["rule_session", "alert_resolution", "holistic_review", "earnings_report"],
    maxContextChars: 1500,
  });

  const result = await runMeteredAiCall({
    userId: params.userId,
    feature: "thesis_draft",
    estimatedCostUsd: ESTIMATED_AI_COST_USD.thesis_draft,
    execute: async () => {
      const response = await callAi({
        weight: "standard",
        taskType: "rule_draft_generation",
        agentName: "rule_builder_agent",
        system: THESIS_DRAFT_SYSTEM_PROMPT,
        prompt: buildThesisDraftPrompt({
          ticker: session.ticker,
          companyName: session.company_name,
          answers: (answers ?? []).map(
            (answer: {
              question_key: string;
              answer_text?: string | null;
              answer_json?: unknown;
            }) => ({
              questionKey: answer.question_key,
              answerText: answer.answer_text,
              answerJson: answer.answer_json,
            }),
          ),
          pastContext: ragResult.contextText,
        }),
        outputSchema: ThesisDraftOutputSchema,
        schemaName: "ThesisDraft",
        promptVersion: "thesis-draft-v1",
        userId: params.userId,
        sourceType: "rule_session",
        sourceId: params.sessionId,
        sessionId: params.sessionId,
        inputJson: { sessionId: params.sessionId, answers: answers ?? [] },
      });
      return {
        result: response,
        actualCostUsd: response.ok ? response.estimatedCostUsd : undefined,
      };
    },
  });

  if (!result.ok) {
    throw new AppError(
      "AI_OUTPUT_INVALID",
      "仮説の下書きを構造化できませんでした。",
      422,
      { providerError: result.error },
      true,
    );
  }

  const safety = runSafetyCheck({
    text: `${result.data.thesis}\n${JSON.stringify(result.data.breakers)}`,
  });
  if (!safety.passed) {
    throw new AppError(
      "SAFETY_FAILED",
      "仮説の下書きに安全性の問題があったため表示できません。",
      422,
      { safety },
      false,
    );
  }

  const compliance = await runComplianceGate({
    userId: params.userId,
    reviewType: "thesis_draft",
    text: `${result.data.thesis}\n${JSON.stringify(result.data.breakers)}`,
  });
  if (!compliance.passed) {
    throw new AppError(
      "SAFETY_FAILED",
      "仮説の下書きにコンプライアンス上の問題があったため表示できません。",
      422,
      { compliance },
      false,
    );
  }

  await updateBreakerQuestion({
    userId: params.userId,
    sessionId: params.sessionId,
    candidates: result.data.breakers,
    source: "ai",
  });

  return {
    thesisDraft: result.data.thesis,
    breakerCandidates: result.data.breakers,
  };
}

export async function applyFallbackBreakerCandidates(params: {
  userId: string;
  sessionId: string;
}) {
  const candidates = FALLBACK_BREAKER_CANDIDATES.map((candidate) => ({
    description: candidate.value,
    newsKeywords: [],
  }));
  await updateBreakerQuestion({
    userId: params.userId,
    sessionId: params.sessionId,
    candidates,
    source: "fallback",
  });
  return candidates;
}

async function updateBreakerQuestion(params: {
  userId: string;
  sessionId: string;
  candidates: Array<{ description: string; newsKeywords: string[] }>;
  source: "ai" | "fallback";
}) {
  const db = await createDatabaseClient();
  const { data: question, error: questionError } = await db
    .from("rule_questions")
    .select("id")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("question_key", "thesis_breakers_pick")
    .single();

  if (questionError || !question) {
    throw new AppError(
      "NOT_FOUND",
      "仮説の破れ条件の質問が見つかりません。",
      404,
      questionError,
    );
  }

  const { error } = await db
    .from("rule_questions")
    .update({
      options: params.candidates.map((candidate) => ({
        label: candidate.description,
        value: candidate.description,
      })),
      breaker_source: params.source,
    })
    .eq("id", question.id)
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId);

  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "仮説の破れ条件の更新に失敗しました。",
      500,
      error,
    );
  }
}
