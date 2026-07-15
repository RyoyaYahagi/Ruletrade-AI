import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";

export async function assertOwnRuleSession(params: {
  userId: string;
  sessionId: string;
}) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("rule_design_sessions")
    .select("id, user_id, status")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();

  if (error || !data) {
    throw new AppError(
      "NOT_FOUND",
      "ルール作成セッションが見つかりません。",
      404,
    );
  }

  return data;
}
