import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { createRuleSession } from "@/features/rules/services/rule-session-service";

export async function createRuleSessionFromPortfolioPosition(params: {
  userId: string;
  positionId: string;
}) {
  const db = await createDatabaseClient();

  const { data: position, error } = await db
    .from("portfolio_positions")
    .select("*")
    .eq("id", params.positionId)
    .eq("user_id", params.userId)
    .single();

  if (error || !position) {
    throw new AppError("NOT_FOUND", "保有銘柄が見つかりません。", 404);
  }

  if (position.rule_session_id != null) {
    throw new AppError(
      "CONFLICT",
      "この保有銘柄には既にルールが設定されています。",
      409,
    );
  }

  if (position.position_status === "archived") {
    throw new AppError(
      "VALIDATION_ERROR",
      "アーカイブ済みの保有銘柄にはルールを作成できません。",
      400,
    );
  }

  const result = await createRuleSession({
    userId: params.userId,
    ticker: position.ticker,
    companyName: position.company_name ?? undefined,
    market: position.market ?? undefined,
    currency: position.currency ?? "JPY",
    templateKey: "portfolio-position",
  });

  if (typeof position.memo === "string" && position.memo.trim() !== "") {
    const { error: ruleJsonError } = await db
      .from("rule_design_sessions")
      .update({
        rule_json: {
          freeNotes: position.memo,
        },
      })
      .eq("id", result.sessionId)
      .eq("user_id", params.userId);

    if (ruleJsonError) {
      throw new AppError(
        "INTERNAL_ERROR",
        "ルールのメモ保存に失敗しました。",
        500,
        ruleJsonError,
      );
    }
  }

  const { error: positionUpdateError } = await db
    .from("portfolio_positions")
    .update({ rule_session_id: result.sessionId })
    .eq("id", params.positionId)
    .eq("user_id", params.userId);

  if (positionUpdateError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "保有銘柄へのルール紐付けに失敗しました。",
      500,
      positionUpdateError,
    );
  }

  return { sessionId: result.sessionId };
}
