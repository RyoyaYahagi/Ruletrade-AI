import "server-only";

import { callAi } from "@/lib/ai/provider-gateway";
import type { AIProviderErrorCode } from "@/lib/ai/ai-provider-error";
import { AppError } from "@/lib/errors/app-error";
import { runMeteredAiCall } from "@/lib/cost-limit/run-metered-ai-call";
import { ESTIMATED_AI_COST_USD } from "@/lib/cost-limit/cost-limit-types";
import { createDatabaseClient } from "@/lib/db/database-client";
import { retrieveRagContext } from "@/features/rag/services/retrieve-rag-context";
import {
  collectThesisResearchSources,
  getThesisResearchSourceVersion,
} from "@/features/rules/services/thesis-research-source-service";
import {
  createThesisResearchInputHash,
  getCachedThesisResearchRun,
  parseCachedDraft,
  parseCachedSources,
  saveThesisResearchRun,
} from "@/features/rules/services/thesis-research-run-service";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { runComplianceGate } from "@/features/legal/services/compliance-gate-service";
import {
  FALLBACK_BREAKER_CANDIDATES,
} from "@/features/rules/constants/question-catalog";
import {
  buildThesisDraftPrompt,
  THESIS_DRAFT_SYSTEM_PROMPT,
} from "@/features/rules/prompts/thesis-draft-prompt";
import {
  ThesisDraftOutputSchema,
  type ThesisDraftOutput,
  type ThesisResearchSource,
} from "@/schemas/rules/thesis-research-schema";
import {
  createRuleAiTrace,
  getRuleAiTraceForResearchRun,
  hashValue,
} from "@/features/rules/services/rule-ai-trace-service";
import { trackRuleFunnelEvent } from "@/features/rules/services/rule-analytics-service";

export type ThesisDraftPhase =
  | "researching_company"
  | "researching_financials"
  | "researching_news"
  | "drafting"
  | "verifying_sources"
  | "completed";

export async function generateThesisDraft(params: {
  userId: string;
  sessionId: string;
  onPhase?: (phase: ThesisDraftPhase) => void;
}): Promise<{
  thesisDraft: string;
  breakerCandidates: Array<{
    description: string;
    newsKeywords: string[];
  }>;
  thesisSegments: ThesisDraftOutput["thesisSegments"];
  evidence: ThesisDraftOutput["evidence"];
  research: {
    runId: string;
    status: "completed" | "partial";
    sources: ThesisResearchSource[];
    growthDefinition: string;
    growthIndicators: string[];
    nearTermFactors: string[];
    invalidationConditions: string[];
    errors: string[];
  };
  traceId?: string | null;
}> {
  const db = await createDatabaseClient();
  const { data: session, error: sessionError } = await db
    .from("rule_design_sessions")
    .select("id, ticker, company_name, market")
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

  const answerInput = (answers ?? []).map((answer: Record<string, unknown>) => ({
    questionKey: String(answer.question_key),
    answerText: answer.answer_text,
    answerJson: answer.answer_json,
  }));
  const sourceVersion = await getThesisResearchSourceVersion({
    userId: params.userId,
    ticker: session.ticker,
    market: session.market ?? "JP",
  });
  const inputHash = createThesisResearchInputHash({
    ticker: session.ticker,
    companyName: session.company_name,
    sourceVersion,
    answers: answerInput,
  });
  const cachedRun = await getCachedThesisResearchRun({
    userId: params.userId,
    sessionId: params.sessionId,
    inputHash,
  });
  const cachedDraft = parseCachedDraft(cachedRun?.draft_json);
  const cachedSources = parseCachedSources(cachedRun?.sources_json);
  if (cachedRun?.id && cachedDraft && cachedSources.length > 0) {
    const cachedTrace = await getRuleAiTraceForResearchRun({
      userId: params.userId,
      researchRunId: String(cachedRun.id),
    });
    await recordAnalyticsEvent({
      userId: params.userId,
      sessionId: params.sessionId,
      eventName: "thesis_draft_cache_hit",
      questionKey: "thesis_draft",
      metadata: { researchRunId: String(cachedRun.id) },
    });
    params.onPhase?.("completed");
    await persistBreakerCandidates({
      userId: params.userId,
      sessionId: params.sessionId,
      candidates: cachedDraft.breakers,
    });
    return buildDraftResponse({
      runId: String(cachedRun.id),
      status: cachedRun.status === "partial" ? "partial" : "completed",
      sources: cachedSources.filter((source) => source.verified),
      errors: readResearchErrors(cachedRun.research_json),
      draft: cachedDraft,
      traceId: cachedTrace?.id ? String(cachedTrace.id) : null,
    });
  }

  params.onPhase?.("researching_company");
  const ragResult = await retrieveRagContext({
    userId: params.userId,
    taskType: "rule_draft_generation",
    queryText: `${session.ticker} ${session.company_name ?? ""} 投資仮説`,
    sourceTypes: ["rule_session", "alert_resolution", "holistic_review", "earnings_report"],
    maxContextChars: 1500,
  });

  params.onPhase?.("researching_financials");
  const collection = await collectThesisResearchSources({
    userId: params.userId,
    ticker: session.ticker,
    market: session.market ?? "JP",
    companyName: session.company_name,
  });
  params.onPhase?.("researching_news");
  if (collection.sources.length === 0) {
    await saveThesisResearchRun({
      userId: params.userId,
      sessionId: params.sessionId,
      inputHash,
      status: "failed",
      sources: [],
      research: { errors: collection.errors },
      errorMessage: "有効な調査ソースがありません。",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    throw new AppError(
      "PROCESSING_FAILED",
      "調査ソースが見つからないため、企業調査付きの下書きを作成できません。企業IR資料のURLを登録するか、決算資料を追加してください。",
      422,
      { errors: collection.errors },
      true,
    );
  }

  const researchContext = buildResearchContext(collection.sources);
  params.onPhase?.("drafting");

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
          answers: answerInput,
          pastContext: ragResult.contextText,
          researchContext,
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
    throw createThesisDraftProviderError(result);
  }

  const parsedDraft = ThesisDraftOutputSchema.safeParse(result.data);
  if (!parsedDraft.success) {
    throw new AppError(
      "AI_OUTPUT_INVALID",
      "企業調査の参照情報を含む下書きを構造化できませんでした。",
      422,
      parsedDraft.error.flatten(),
      true,
    );
  }

  params.onPhase?.("verifying_sources");
  const verifiedResult = verifyDraftEvidence({
    draft: parsedDraft.data,
    sources: collection.sources,
  });
  const verifiedDraft = verifiedResult.draft;
  const verifiedSources = verifiedResult.sources;

  const safety = runSafetyCheck({
    text: `${verifiedDraft.thesis}\n${JSON.stringify(verifiedDraft.breakers)}`,
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
    text: `${verifiedDraft.thesis}\n${JSON.stringify(verifiedDraft.breakers)}`,
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

  const savedRun = await saveThesisResearchRun({
    userId: params.userId,
    sessionId: params.sessionId,
    inputHash,
    status: collection.errors.length > 0 ? "partial" : "completed",
    sources: verifiedSources.map((item) => item.source),
    research: {
      errors: collection.errors,
      growthDefinition: verifiedDraft.growthDefinition,
      growthIndicators: verifiedDraft.growthIndicators,
      nearTermFactors: verifiedDraft.nearTermFactors,
      invalidationConditions: verifiedDraft.invalidationConditions,
    },
    draft: verifiedDraft,
    provider: result.provider,
    model: result.model,
  });

  const trace = await createRuleAiTrace({
    userId: params.userId,
    sessionId: params.sessionId,
    questionKey: "thesis_draft",
    aiRunLogId: result.aiRunLogId,
    thesisResearchRunId: String(savedRun.id),
    traceType: "thesis_draft",
    status: "succeeded",
    answerContextHash: hashValue(answerInput),
    input: {
      answers: answerInput,
      researchSourceRefs: verifiedSources.map((item) => item.source.ref),
      researchErrors: collection.errors,
    },
    output: verifiedDraft,
    comparisonOutput: {
      thesis: verifiedDraft.thesis,
      answerJson: { text: verifiedDraft.thesis },
    },
    provider: result.provider,
    model: result.model,
    promptVersion: "thesis-draft-v1",
    schemaValid: true,
    safetyPassed: safety.passed,
    compliancePassed: compliance.passed,
    sensitiveValues: [session.ticker, session.company_name ?? ""],
  });

  await persistBreakerCandidates({
    userId: params.userId,
    sessionId: params.sessionId,
    candidates: verifiedDraft.breakers,
  });
  params.onPhase?.("completed");

  return buildDraftResponse({
    runId: String(savedRun.id),
    status: collection.errors.length > 0 ? "partial" : "completed",
    sources: verifiedSources.map((item) => item.source),
    errors: collection.errors,
    draft: verifiedDraft,
    traceId: trace.traceId,
  });
}

function createThesisDraftProviderError(result: {
  ok: false;
  error: string;
  code?: AIProviderErrorCode;
  retryable?: boolean;
}) {
  if (result.code === "AI_PROVIDER_TIMEOUT") {
    return new AppError(
      "AI_PROVIDER_TIMEOUT",
      "AI下書きの生成がタイムアウトしました。しばらく待ってから再試行してください。",
      504,
      { providerError: result.error, providerCode: result.code },
      true,
    );
  }

  if (
    result.code === "AI_OUTPUT_PARSE_FAILED" ||
    result.code === "AI_OUTPUT_SCHEMA_INVALID"
  ) {
    return new AppError(
      "AI_OUTPUT_INVALID",
      "AIが必要な構造化形式で返答しなかったため、下書きを作成できませんでした。",
      422,
      { providerError: result.error, providerCode: result.code },
      result.retryable ?? true,
    );
  }

  return new AppError(
    "AI_PROVIDER_ERROR",
    "AI下書きの生成に失敗しました。しばらく待ってから再試行してください。",
    503,
    { providerError: result.error, providerCode: result.code },
    result.retryable ?? true,
  );
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

async function persistBreakerCandidates(params: {
  userId: string;
  sessionId: string;
  candidates: ThesisDraftOutput["breakers"];
}) {
  await updateBreakerQuestion({
    userId: params.userId,
    sessionId: params.sessionId,
    candidates: params.candidates,
    source: "ai",
  });
}

function buildResearchContext(
  sources: Array<{ source: ThesisResearchSource; content: string }>,
) {
  return sources
    .map(({ source, content }) =>
      [
        `[${source.ref}] ${source.title} / ${source.publisher}`,
        `URL: ${source.url ?? "内部データ"}`,
        `本文: ${content.slice(0, 7000)}`,
      ].join("\n"),
    )
    .join("\n\n")
    .slice(0, 32_000);
}

function verifyDraftEvidence(params: {
  draft: ThesisDraftOutput;
  sources: Array<{ source: ThesisResearchSource; content: string }>;
}) {
  const sourceByRef = new Map(
    params.sources.map((item) => [item.source.ref, item]),
  );
  const verifiedEvidence = params.draft.evidence.filter((evidence) => {
    const source = sourceByRef.get(evidence.sourceRef);
    return Boolean(source && containsNormalized(source.content, evidence.quote));
  });
  if (verifiedEvidence.length === 0) {
    throw new AppError(
      "AI_OUTPUT_INVALID",
      "AIが参照した引用箇所を検証できませんでした。",
      422,
      { evidence: params.draft.evidence },
      true,
    );
  }

  const evidenceRefs = new Set(verifiedEvidence.map((item) => item.sourceRef));
  const sources = params.sources.map((item) => {
    const evidence = verifiedEvidence.find(
      (candidate) => candidate.sourceRef === item.source.ref,
    );
    return evidence
      ? {
          ...item,
          source: {
            ...item.source,
            highlightText: evidence.quote,
            verified: true,
          },
        }
      : item;
  });

  return {
    draft: {
      ...params.draft,
      evidence: verifiedEvidence,
      thesisSegments: params.draft.thesisSegments.map((segment) => ({
        ...segment,
        sourceRefs: segment.sourceRefs.filter((ref) => evidenceRefs.has(ref)),
      })),
      breakers: params.draft.breakers.map((breaker) => ({
        ...breaker,
        sourceRefs: breaker.sourceRefs.filter((ref) => evidenceRefs.has(ref)),
      })),
    },
    sources: sources
      .filter((item) => item.source.verified)
      .map((item) => ({
        ...item,
        source: { ...item.source },
      })),
  };
}

function containsNormalized(content: string, quote: string) {
  return normalizeText(content).includes(normalizeText(quote));
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function readResearchErrors(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const errors = (value as { errors?: unknown }).errors;
  return Array.isArray(errors) ? errors.filter((item): item is string => typeof item === "string") : [];
}

function buildDraftResponse(params: {
  runId: string;
  status: "completed" | "partial";
  sources: ThesisResearchSource[];
  errors: string[];
  draft: ThesisDraftOutput;
  traceId?: string | null;
}) {
  const displayedSources = params.sources.filter((source) => source.verified);
  return {
    thesisDraft: params.draft.thesis,
    breakerCandidates: params.draft.breakers.map(({ description, newsKeywords }) => ({
      description,
      newsKeywords,
    })),
    thesisSegments: params.draft.thesisSegments,
    evidence: params.draft.evidence,
    research: {
      runId: params.runId,
      status: params.status,
      sources: displayedSources,
      growthDefinition: params.draft.growthDefinition,
      growthIndicators: params.draft.growthIndicators,
      nearTermFactors: params.draft.nearTermFactors,
      invalidationConditions: params.draft.invalidationConditions,
      errors: params.errors,
    },
    traceId: params.traceId ?? null,
  };
}

async function recordAnalyticsEvent(params: {
  userId: string;
  sessionId: string;
  eventName: "thesis_draft_cache_hit";
  questionKey: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await trackRuleFunnelEvent(params);
  } catch (error) {
    console.error("Failed to record thesis draft analytics event:", error);
  }
}
