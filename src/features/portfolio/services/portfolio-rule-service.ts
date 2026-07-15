import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import {
  PortfolioCommonRuleSchema,
  type PortfolioCommonRule,
} from "@/schemas/portfolio/portfolio-rule-schema";

export async function getPortfolioCommonRule(params: {
  userId: string;
}): Promise<{ rule: PortfolioCommonRule | null }> {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("portfolio_rules")
    .select("*")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "共通ルールの取得に失敗しました。",
      500,
      error,
    );
  }

  if (!data?.rule_json) {
    return { rule: null };
  }

  const parsed = PortfolioCommonRuleSchema.safeParse(data.rule_json);
  if (!parsed.success) {
    return { rule: null };
  }

  return { rule: parsed.data };
}

export async function upsertPortfolioCommonRule(params: {
  userId: string;
  rule: PortfolioCommonRule;
}): Promise<{ rule: PortfolioCommonRule }> {
  const db = await createDatabaseClient();

  const { data: existing, error: findError } = await db
    .from("portfolio_rules")
    .select("id")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (findError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "共通ルールの確認に失敗しました。",
      500,
      findError,
    );
  }

  if (existing) {
    const { error: updateError } = await db
      .from("portfolio_rules")
      .update({ rule_json: params.rule })
      .eq("id", existing.id)
      .eq("user_id", params.userId);

    if (updateError) {
      throw new AppError(
        "INTERNAL_ERROR",
        "共通ルールの更新に失敗しました。",
        500,
        updateError,
      );
    }

    return { rule: params.rule };
  }

  const { error: insertError } = await db.from("portfolio_rules").insert({
    user_id: params.userId,
    rule_json: params.rule,
  });

  if (insertError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "共通ルールの保存に失敗しました。",
      500,
      insertError,
    );
  }

  return { rule: params.rule };
}
