import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { createRuleVersion } from "@/features/rules/services/rule-session-service";

export async function finalizeRuleSession(params: {
  userId: string;
  sessionId: string;
  force: boolean;
}) {
  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase
    .from("rule_design_sessions")
    .select("id, completion_score, quality_gate_status, rule_json, status")
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
  const canFinalize =
    completionScore >= 95 &&
    session.quality_gate_status === "passed" &&
    session.status === "quality_gate_passed";

  if (!params.force && !canFinalize) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Quality Gateを通過していないため、まだ完成版として保存できません。",
      400,
      {
        completionScore,
        qualityGateStatus: session.quality_gate_status,
        status: session.status,
      },
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

  return { sessionId: params.sessionId, status: "finalized" };
}
