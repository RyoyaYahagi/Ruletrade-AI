import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { upsertRagDocument } from "@/features/rag/services/upsert-rag-document";

const EARNINGS_SOURCE_TYPE = "earnings_report" as const;

export async function indexDocumentForRag(params: {
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

  const documentKind = String(document.document_kind ?? "note");
  const sourceType = documentKind === "earnings_report" ? EARNINGS_SOURCE_TYPE : "manual_note";
  if (sourceType === EARNINGS_SOURCE_TYPE) {
    const shouldIndex = await removeOlderEarningsIndexes({
      userId: params.userId,
      documentId: document.id,
      ticker: String(document.ticker),
      fiscalPeriod: String(document.fiscal_period),
    });
    if (!shouldIndex) {
      await db
        .from("rag_chunks")
        .delete()
        .eq("user_id", params.userId)
        .eq("source_type", EARNINGS_SOURCE_TYPE)
        .eq("source_id", document.id);
      await db
        .from("rag_documents")
        .delete()
        .eq("user_id", params.userId)
        .eq("source_type", EARNINGS_SOURCE_TYPE)
        .eq("source_id", document.id);
      await db
        .from("user_documents")
        .update({ rag_status: "stale" })
        .eq("id", params.documentId)
        .eq("user_id", params.userId);
      return { documentId: params.documentId, ragStatus: "stale" as const };
    }
  }

  await upsertRagDocument({
    userId: params.userId,
    sourceType,
    sourceId: document.id,
    title: document.title,
    content: buildDocumentRagContent(document),
    metadata: {
      documentId: document.id,
      documentType: document.document_type,
      ticker: document.ticker,
      companyName: document.company_name,
      originalFilename: document.original_filename,
      documentKind,
      fiscalPeriod: document.fiscal_period,
    },
  });

  await db
    .from("user_documents")
    .update({
      rag_status: "indexed",
      indexed_at: new Date().toISOString(),
    })
    .eq("id", params.documentId)
    .eq("user_id", params.userId);

  return {
    documentId: params.documentId,
    ragStatus: "indexed",
  };
}

function buildDocumentRagContent(document: {
  title: string;
  document_type: string;
  ticker?: string | null;
  company_name?: string | null;
  source_url?: string | null;
  extracted_text?: string | null;
  document_kind?: string | null;
  fiscal_period?: string | null;
}) {
  return [
    `資料タイトル: ${document.title}`,
    `資料種別: ${document.document_type}`,
    document.document_kind === "earnings_report"
      ? `会計期間: ${document.fiscal_period ?? "未設定"}`
      : null,
    document.ticker ? `銘枤: ${document.ticker}` : null,
    document.company_name ? `企業名: ${document.company_name}` : null,
    document.source_url ? `参照URL: ${document.source_url}` : null,
    "",
    document.extracted_text,
  ]
    .filter(Boolean)
    .join("\n");
}

async function removeOlderEarningsIndexes(params: {
  userId: string;
  documentId: string;
  ticker: string;
  fiscalPeriod: string;
}): Promise<boolean> {
  if (!params.ticker || !/^FY\d{4}(Q[1-4])?$/.test(params.fiscalPeriod)) {
    throw new AppError("VALIDATION_ERROR", "決算資料の銘柄と会計期間が正しくありません。", 400);
  }
  const db = await createDatabaseClient();
  const { data: documents, error } = await db
    .from("user_documents")
    .select("id, fiscal_period")
    .eq("user_id", params.userId)
    .eq("document_kind", "earnings_report")
    .eq("ticker", params.ticker);
  if (error) throw error;

  const currentPeriodKey = fiscalPeriodKey(params.fiscalPeriod);
  const hasNewerDocument = (documents ?? []).some(
    (document: { id: string; fiscal_period?: string | null }) =>
      document.id !== params.documentId &&
      fiscalPeriodKey(String(document.fiscal_period ?? "")) > currentPeriodKey,
  );
  for (const document of documents ?? []) {
    if (document.id === params.documentId) continue;
    const period = String(document.fiscal_period ?? "");
    if (!period || fiscalPeriodKey(period) >= currentPeriodKey) continue;
    await db
      .from("rag_chunks")
      .delete()
      .eq("user_id", params.userId)
      .eq("source_type", EARNINGS_SOURCE_TYPE)
      .eq("source_id", document.id);
    await db
      .from("rag_documents")
      .delete()
      .eq("user_id", params.userId)
      .eq("source_type", EARNINGS_SOURCE_TYPE)
      .eq("source_id", document.id);
  }
  return !hasNewerDocument;
}

export function fiscalPeriodKey(value: string) {
  const match = /^FY(\d{4})(?:Q([1-4]))?$/.exec(value);
  if (!match) return -1;
  return Number(match[1]) * 10 + Number(match[2] ?? 4);
}
