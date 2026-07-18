import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { createRuleVersion } from "@/features/rules/services/rule-session-service";
import { trackRuleFunnelEvent } from "@/features/rules/services/rule-analytics-service";

export async function finalizeRuleSession(params: {
  userId: string;
  sessionId: string;
  force: boolean;
}) {
  const db = await createDatabaseClient();
  const { data: session, error: sessionError } = await db
    .from("rule_design_sessions")
    .select("id, completion_score, quality_gate_status, rule_json")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();
  if (sessionError || !session) {
    throw new AppError(
      "NOT_FOUND",
      "ルール作成セッションが見つかりません。",
      404,
    );
  }

  const completionScore = session.completion_score ?? 0;
  if (!params.force && completionScore < 80) {
    throw new AppError(
      "VALIDATION_ERROR",
      "完成度スコアが低いため、まだ完成版として保存できません。",
      400,
      { completionScore },
    );
  }

  const { error: updateError } = await db
    .from("rule_design_sessions")
    .update({
      status: "finalized",
      finalized_at: new Date().toISOString(),
    })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId);
  if (updateError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ルールの完成保存に失敗しました。",
      500,
      updateError,
    );
  }

  await createRuleVersion({
    userId: params.userId,
    sessionId: params.sessionId,
    ruleJson: session.rule_json,
    changeReason: "完成版として保存",
    createdBy: "user",
  });

  try {
    await trackRuleFunnelEvent({
      userId: params.userId,
      sessionId: params.sessionId,
      eventName: "session_completed",
    });
  } catch (eventError) {
    console.error("Failed to record rule session completion event:", eventError);
  }

  return { sessionId: params.sessionId, status: "finalized" };
}
