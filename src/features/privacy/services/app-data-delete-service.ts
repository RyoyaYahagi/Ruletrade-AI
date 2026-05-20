import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { deleteAllUserStorageObjects } from "@/features/privacy/services/storage-delete-service";
import { logPrivacyAudit } from "@/features/privacy/services/privacy-audit-service";

export async function deleteUserAppData(params: { userId: string }) {
  const supabase = await createServerClient();

  await deleteAllUserStorageObjects({ userId: params.userId });

  const deleteOrder = [
    "document_rag_links",
    "document_summaries",
    "document_extraction_jobs",
    "user_documents",
    "rag_retrieval_logs",
    "embedding_jobs",
    "rag_chunks",
    "rag_documents",
    "notification_delivery_logs",
    "notifications",
    "notification_preferences",
    "watchlist_quality_checks",
    "watchlist_reviews",
    "watchlist_items",
    "watchlists",
    "portfolio_quality_checks",
    "portfolio_reviews",
    "portfolio_positions",
    "portfolios",
    "rule_quality_checks",
    "rule_reviews",
    "rule_answers",
    "rule_questions",
    "rule_versions",
    "rule_design_sessions",
    "api_error_logs",
    "ai_run_logs",
    "investor_profiles",
  ];

  for (const table of deleteOrder) {
    await supabase.from(table).delete().eq("user_id", params.userId);
  }

  await logPrivacyAudit({
    userId: params.userId,
    actorUserId: params.userId,
    action: "app_data_deleted",
  });

  return { deleted: true };
}
