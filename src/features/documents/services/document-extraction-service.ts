import "server-only";

import { createHash } from "crypto";
import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { readLocalStorageFile } from "@/lib/storage/local-file-storage";

export async function extractDocumentText(params: {
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

  // extraction job を作成
  const { data: job, error: jobError } = await db
    .from("document_extraction_jobs")
    .insert({
      user_id: params.userId,
      document_id: params.documentId,
      status: "processing",
      extractor: "local",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobError || !job) {
    throw new AppError(
      "INTERNAL_ERROR",
      "抽出ジョブの作成に失敗しました。",
      500,
      jobError,
    );
  }

  try {
    const buffer = await readLocalStorageFile({
      bucket: "documents",
      storagePath: document.storage_path,
    });

    const extractedText = await extractTextByMimeType({
      mimeType: document.mime_type,
      buffer,
    });

    const normalizedText = normalizeExtractedText(extractedText);

    await db
      .from("user_documents")
      .update({
        extracted_text: normalizedText,
        extracted_text_hash: normalizedText
          ? createHash("sha256").update(normalizedText).digest("hex")
          : null,
        extraction_status: normalizedText ? "extracted" : "skipped",
        extracted_at: new Date().toISOString(),
      })
      .eq("id", params.documentId)
      .eq("user_id", params.userId);

    await db
      .from("document_extraction_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("user_id", params.userId);

    return {
      documentId: params.documentId,
      extractionStatus: normalizedText ? "extracted" : "skipped",
      textLength: normalizedText?.length ?? 0,
    };
  } catch (error) {
    await db
      .from("user_documents")
      .update({
        extraction_status: "failed",
      })
      .eq("id", params.documentId)
      .eq("user_id", params.userId);

    await db
      .from("document_extraction_jobs")
      .update({
        status: "failed",
        error_message:
          error instanceof Error ? error.message : "Unknown extraction error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("user_id", params.userId);

    throw new AppError(
      "PROCESSING_FAILED",
      "資料本文の抽出に失敗しました。",
      500,
      error,
    );
  }
}

async function extractTextByMimeType(params: {
  mimeType: string;
  buffer: Buffer;
}) {
  if (params.mimeType === "application/pdf") {
    const { default: pdf } = await import("pdf-parse");
    const result = await pdf(params.buffer);
    return result.text as string;
  }

  if (params.mimeType === "text/plain" || params.mimeType === "text/markdown") {
    return params.buffer.toString("utf-8");
  }

  throw new AppError(
    "VALIDATION_ERROR",
    "対応していないファイル形式です。",
    400,
  );
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
