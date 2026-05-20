import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { logPrivacyAudit } from "@/features/privacy/services/privacy-audit-service";

export async function requestDataExport(params: {
  userId: string;
  exportFormat: string;
  includeAiLogs: boolean;
  includeDocumentsMetadata: boolean;
  includeExtractedText: boolean;
  includeRagChunks: boolean;
}) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("data_export_requests")
    .insert({
      user_id: params.userId,
      status: "pending",
      export_format: params.exportFormat,
      include_ai_logs: params.includeAiLogs,
      include_documents_metadata: params.includeDocumentsMetadata,
      include_extracted_text: params.includeExtractedText,
      include_rag_chunks: params.includeRagChunks,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("INTERNAL_ERROR", "Export request failed.", 500, error);
  }

  await logPrivacyAudit({
    userId: params.userId,
    actorUserId: params.userId,
    action: "data_export_requested",
    targetType: "export",
    targetId: data.id,
  });

  return { exportRequest: data };
}

export async function generateUserDataExport(params: {
  userId: string;
  exportRequestId: string;
}) {
  const supabase = await createServerClient();

  const { data: request, error: reqError } = await supabase
    .from("data_export_requests")
    .select("*")
    .eq("id", params.exportRequestId)
    .eq("user_id", params.userId)
    .single();

  if (reqError || !request) {
    throw new AppError("NOT_FOUND", "Export request not found.", 404);
  }

  const result: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    user_id: params.userId,
  };

  const { data: sessions } = await supabase
    .from("rule_design_sessions")
    .select("*")
    .eq("user_id", params.userId);
  result.rule_design_sessions = sessions ?? [];

  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", params.userId);
  result.portfolios = portfolios ?? [];

  const { data: watchlists } = await supabase
    .from("watchlists")
    .select("*")
    .eq("user_id", params.userId);
  result.watchlists = watchlists ?? [];

  const { data: documents } = await supabase
    .from("user_documents")
    .select(
      request.include_extracted_text
        ? "*"
        : "id, title, mime_type, document_type, created_at",
    )
    .eq("user_id", params.userId);
  result.documents = documents ?? [];

  if (request.include_ai_logs) {
    const { data: logs } = await supabase
      .from("ai_run_logs")
      .select(
        "id, task_type, model, provider, latency_ms, token_usage, estimated_cost_usd, safety_passed, schema_valid, created_at",
      )
      .eq("user_id", params.userId)
      .order("created_at", { ascending: false })
      .limit(1000);
    result.ai_logs = logs ?? [];
  }

  if (request.include_rag_chunks) {
    const { data: ragDocs } = await supabase
      .from("rag_documents")
      .select("id, source_type, source_id, title, hash, created_at")
      .eq("user_id", params.userId);
    result.rag_documents = ragDocs ?? [];
  }

  await supabase
    .from("data_export_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", params.exportRequestId);

  await logPrivacyAudit({
    userId: params.userId,
    actorUserId: params.userId,
    action: "data_export_completed",
    targetType: "export",
    targetId: params.exportRequestId,
  });

  return { export: result };
}
