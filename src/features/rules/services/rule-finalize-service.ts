import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { createRuleVersion } from "@/features/rules/services/rule-session-service";

export async function finalizeRuleSession(params: {
  userId: string;
  sessionId: string;
  force: boolean;
}) {
  const supabase = await createServerClient();
  const { data: session, error: sessionError } = await supabase
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

  const { error: updateError } = await supabase
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

  // Create a notification for the user to review their finalized rule
  try {
    const { createNotification } = await import(
      "@/features/notifications/services/notification-service"
    );
    await createNotification({
      userId: params.userId,
      user_id: params.userId,
      type: "review_reminder",
      title: "投資ルールが完成しました",
      body: "作成した投資ルールを見直し、定期的に確認しましょう。",
      action_url: `/rules/${params.sessionId}`,
      is_read: false,
    });
  } catch {
    // Notification creation is best-effort; don't fail finalize if it errors
  }

  return { sessionId: params.sessionId, status: "finalized" };
}
