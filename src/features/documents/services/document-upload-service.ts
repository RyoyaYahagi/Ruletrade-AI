import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { writeLocalStorageFile } from "@/lib/storage/local-file-storage";
import { UserDocumentSchema } from "@/schemas/documents/document-schema";
import { linkDocumentToTarget } from "@/features/documents/services/document-link-service";

export async function uploadDocument(params: {
  userId: string;
  file: Buffer;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  documentType: string;
  documentKind?: "note" | "earnings_report";
  fiscalPeriod?: string;
  ticker?: string;
  companyName?: string;
  sourceUrl?: string;
}) {
  const metadataValidation = UserDocumentSchema.safeParse({
    title: params.title,
    originalFilename: params.originalFilename,
    mimeType: params.mimeType,
    fileSizeBytes: params.fileSizeBytes,
    documentType: params.documentType,
    documentKind: params.documentKind ?? "note",
    fiscalPeriod: params.fiscalPeriod,
    ticker: params.ticker,
    companyName: params.companyName,
    sourceUrl: params.sourceUrl,
  });
  if (!metadataValidation.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "資料の種別・銘柄・会計期間の組み合わせを確認してください。",
      400,
      metadataValidation.error.flatten(),
    );
  }

  const db = await createDatabaseClient();

  // ファイル名を安全化
  const safeFilename = params.originalFilename
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 200);

  // DBにmetadataを保存してdocument_idを取得
  const { data: document, error: dbError } = await db
    .from("user_documents")
    .insert({
      user_id: params.userId,
      title: params.title,
      original_filename: params.originalFilename,
      storage_bucket: "documents",
      storage_path: "placeholder",
      mime_type: params.mimeType,
      file_size_bytes: params.fileSizeBytes,
      document_type: params.documentType,
      document_kind: params.documentKind ?? "note",
      fiscal_period: params.fiscalPeriod ?? null,
      ticker: params.ticker ?? null,
      company_name: params.companyName ?? null,
      source_url: params.sourceUrl ?? null,
      metadata: {},
      uploaded_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (dbError || !document) {
    throw new AppError(
      "INTERNAL_ERROR",
      "資料メタデータの保存に失敗しました。",
      500,
      dbError,
    );
  }

  const documentId = document.id;

  const storagePath = `${params.userId}/${documentId}/${safeFilename}`;

  try {
    await writeLocalStorageFile({
      bucket: "documents",
      storagePath,
      data: params.file,
    });
  } catch (storageError) {
    await db
      .from("user_documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", params.userId);

    throw new AppError(
      "INTERNAL_ERROR",
      "資料ファイルのアップロードに失敗しました。",
      500,
      storageError,
    );
  }

  const { error: updateError } = await db
    .from("user_documents")
    .update({
      storage_path: storagePath,
    })
    .eq("id", documentId)
    .eq("user_id", params.userId);

  if (updateError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "資料パスの更新に失敗しました。",
      500,
      updateError,
    );
  }

  if (params.documentKind === "earnings_report" && params.ticker) {
    const { data: sessions, error: sessionError } = await db
      .from("rule_design_sessions")
      .select("id")
      .eq("user_id", params.userId)
      .eq("ticker", params.ticker);
    if (sessionError) throw sessionError;
    for (const session of sessions ?? []) {
      await linkDocumentToTarget({
        userId: params.userId,
        documentId,
        targetType: "rule_session",
        targetId: session.id,
        linkReason: "earnings_report_ticker_match",
      });
    }
  }

  return {
    documentId,
    storagePath,
  };
}
