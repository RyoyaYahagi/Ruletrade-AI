import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { DocumentSummarySchema } from "@/schemas/documents/document-summary-schema";
import {
  buildDocumentSummaryPrompt,
  DOCUMENT_SUMMARY_PROMPT_VERSION,
} from "@/features/documents/prompts/document-summary-prompt";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { AppError } from "@/lib/errors/app-error";

export async function summarizeDocument(params: {
  userId: string;
  documentId: string;
}) {
  const db = await createDatabaseClient();

  const { data: document, error } = await db
    .from("user_documents")
    .select("*")
    .eq("id", params.documentId)
    .eq("user_id", params.userId)
    .single();

  if (error || !document) {
    throw new AppError("NOT_FOUND", "資料が見つかりません。", 404);
  }

  if (!document.extracted_text) {
    throw new AppError("VALIDATION_ERROR", "本文抽出が完了していません。", 400);
  }

  const prompt = buildDocumentSummaryPrompt({
    title: document.title,
    documentType: document.document_type,
    ticker: document.ticker,
    companyName: document.company_name,
    extractedText: document.extracted_text,
  });

  const ai = getAIProvider();

  const aiResult = await ai.generateObject({
    taskType: "document_rag_review",
    schema: DocumentSummarySchema,
    schemaName: "DocumentSummary",
    promptVersion: DOCUMENT_SUMMARY_PROMPT_VERSION,
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

  const summary = aiResult.data;

  const safetyText = [
    summary.summary,
    ...summary.keyPoints,
    ...summary.risks,
    ...summary.opportunities,
    ...summary.assumptions,
    ...summary.questionsForRuleDesign,
  ].join("\n");

  const safety = runSafetyCheck({ text: safetyText });

  const summaryWithSafety = {
    ...summary,
    safety,
  };

  const { data: savedSummary, error: summaryError } = await db
    .from("document_summaries")
    .insert({
      user_id: params.userId,
      document_id: params.documentId,
      provider: aiResult.meta.provider,
      model: aiResult.meta.model,
      prompt_version:
        aiResult.meta.promptVersion ?? DOCUMENT_SUMMARY_PROMPT_VERSION,
      summary_json: summaryWithSafety,
      summary: safety.passed ? summary.summary : null,
      key_points: safety.passed ? summary.keyPoints : [],
      risks: safety.passed ? summary.risks : [],
      questions: safety.passed ? summary.questionsForRuleDesign : [],
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

  if (summaryError || !savedSummary) {
    throw new AppError(
      "INTERNAL_ERROR",
      "資料要約の保存に失敗しました。",
      500,
      summaryError,
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

  return {
    summaryId: savedSummary.id,
    summary,
  };
}
