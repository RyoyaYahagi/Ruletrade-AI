import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";

export async function assertOwnRuleSession(params: {
  userId: string;
  sessionId: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rule_design_sessions")
    .select("id, user_id, status")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();

  if (error || !data) {
    throw new AppError(
      "NOT_FOUND",
      "ルール作成セッションが見つかりません。",
      404
    );
  }

  return data;
}
