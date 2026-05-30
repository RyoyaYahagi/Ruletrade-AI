import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import {
  upsertRagDocumentFromRuleSession,
  upsertRagDocumentFromWatchlistItem,
} from "@/features/rag/services/upsert-rag-sources";

export async function reindexUserRagDocuments(params: { userId: string }) {
  const supabase = await createServerClient();

  const { data: sessions } = await supabase
    .from("rule_design_sessions")
    .select("id")
    .eq("user_id", params.userId);

  const { data: watchlistItems } = await supabase
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
