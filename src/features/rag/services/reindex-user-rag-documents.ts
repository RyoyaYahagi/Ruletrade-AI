import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import {
  upsertRagDocumentFromRuleSession,
  upsertRagDocumentFromWatchlistItem,
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

  return {
    indexedCount,
    failedCount,
  };
}
