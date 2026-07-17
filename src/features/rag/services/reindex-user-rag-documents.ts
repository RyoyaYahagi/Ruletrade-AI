import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { indexDocumentForRag } from "@/features/documents/services/document-index-service";
import {
  upsertRagDocumentFromRuleSession,
  upsertRagDocumentFromWatchlistItem,
  upsertRagDocumentFromAlertResolution,
  upsertRagDocumentFromNewsAssessment,
  upsertRagDocumentFromHolisticReview,
} from "@/features/rag/services/upsert-rag-sources";

export async function reindexUserRagDocuments(params: { userId: string }) {
  const db = await createDatabaseClient();

  const { data: sessions } = await db
    .from("rule_design_sessions")
    .select("id")
    .eq("user_id", params.userId);

  const { data: watchlistItems } = await db
    .from("watchlist_items")
    .select("id")
    .eq("user_id", params.userId)
    .neq("status", "archived");

  let indexedCount = 0;
  let failedCount = 0;

  // These source types are derived indexes. Clearing only this subset keeps the
  // reindex operation deterministic without disturbing other RAG sources.
  await db
    .from("rag_chunks")
    .delete()
    .eq("user_id", params.userId)
    .in("source_type", ["alert_resolution", "news_assessment", "holistic_review"]);
  await db
    .from("rag_documents")
    .delete()
    .eq("user_id", params.userId)
    .in("source_type", ["alert_resolution", "news_assessment", "holistic_review"]);
  await db
    .from("rag_chunks")
    .delete()
    .eq("user_id", params.userId)
    .eq("source_type", "earnings_report");
  await db
    .from("rag_documents")
    .delete()
    .eq("user_id", params.userId)
    .eq("source_type", "earnings_report");

  for (const session of sessions ?? []) {
    try {
      await upsertRagDocumentFromRuleSession({
        userId: params.userId,
        sessionId: session.id,
      });

      indexedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  for (const item of watchlistItems ?? []) {
    try {
      await upsertRagDocumentFromWatchlistItem({
        userId: params.userId,
        itemId: item.id,
      });

      indexedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  const { data: earningsDocuments, error: earningsError } = await db
    .from("user_documents")
    .select("id")
    .eq("user_id", params.userId)
    .eq("document_kind", "earnings_report")
    .order("fiscal_period", { ascending: false });
  if (earningsError) throw earningsError;

  for (const document of earningsDocuments ?? []) {
    try {
      await indexDocumentForRag({
        userId: params.userId,
        documentId: document.id,
      });
      indexedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  const [{ data: alertEvents }, { data: assessments }, { data: reviews }] =
    await Promise.all([
      db
        .from("rule_alert_events")
        .select("id, resolution")
        .eq("user_id", params.userId),
      db.from("news_assessments").select("id").eq("user_id", params.userId),
      db.from("holistic_reviews").select("id").eq("user_id", params.userId),
    ]);

  for (const event of (alertEvents ?? []).filter((item: Record<string, unknown>) => item.resolution)) {
    try {
      await upsertRagDocumentFromAlertResolution({
        userId: params.userId,
        eventId: event.id,
      });
      indexedCount += 1;
    } catch {
      failedCount += 1;
    }
  }
  for (const assessment of assessments ?? []) {
    try {
      await upsertRagDocumentFromNewsAssessment({
        userId: params.userId,
        assessmentId: assessment.id,
      });
      indexedCount += 1;
    } catch {
      failedCount += 1;
    }
  }
  for (const review of reviews ?? []) {
    try {
      await upsertRagDocumentFromHolisticReview({
        userId: params.userId,
        reviewId: review.id,
      });
      indexedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return {
    indexedCount,
    failedCount,
  };
}
