import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import {
  PortfolioTargetTypeSchema,
  type PortfolioTargetType,
} from "@/schemas/portfolio/portfolio-target-schema";

export type PortfolioTarget = {
  id: string;
  user_id: string;
  portfolio_id: string;
  target_type: PortfolioTargetType;
  target_key: string | null;
  target_percent: number;
  tolerance_percent: number;
  created_at: string;
  updated_at: string;
};

async function assertPortfolioOwnership(params: {
  userId: string;
  portfolioId: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("portfolios")
    .select("id")
    .eq("id", params.portfolioId)
    .eq("user_id", params.userId)
    .single();

  if (error || !data) {
    throw new AppError("NOT_FOUND", "ポートフォリオが見つかりません。", 404);
  }
}

function normalizeTargetKey(params: {
  targetType: PortfolioTargetType;
  targetKey?: string | null;
}) {
  if (params.targetType === "cash_percent") return null;
  if (params.targetType === "position_max_percent") {
    return params.targetKey?.trim() || "*";
  }
  const targetKey = params.targetKey?.trim();
  if (!targetKey) {
    throw new AppError(
      "VALIDATION_ERROR",
      "銘柄別目標には銘柄コードが必要です。",
      400,
    );
  }
  return targetKey;
}

export async function listTargets(params: {
  userId: string;
  portfolioId: string;
}) {
  await assertPortfolioOwnership(params);
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("portfolio_targets")
    .select("*")
    .eq("user_id", params.userId)
    .eq("portfolio_id", params.portfolioId)
    .order("target_type", { ascending: true })
    .order("target_key", { ascending: true });

  if (error) {
    throw new AppError("INTERNAL_ERROR", "ターゲット一覧の取得に失敗しました。", 500, error);
  }

  return { targets: (data ?? []) as PortfolioTarget[] };
}

export async function upsertTarget(params: {
  userId: string;
  portfolioId: string;
  targetType: PortfolioTargetType;
  targetKey?: string | null;
  targetPercent: number;
  tolerancePercent: number;
}) {
  await assertPortfolioOwnership(params);
  const parsedType = PortfolioTargetTypeSchema.safeParse(params.targetType);
  if (!parsedType.success) {
    throw new AppError("VALIDATION_ERROR", "ターゲット種別が正しくありません。", 400);
  }
  if (params.targetPercent < 0 || params.targetPercent > 100) {
    throw new AppError("VALIDATION_ERROR", "目標比率は0〜100%で入力してください。", 400);
  }
  if (params.tolerancePercent < 1 || params.tolerancePercent > 20) {
    throw new AppError("VALIDATION_ERROR", "許容幅は1〜20%で入力してください。", 400);
  }

  const targetKey = normalizeTargetKey({
    targetType: parsedType.data,
    targetKey: params.targetKey,
  });
  const db = await createDatabaseClient();
  let query = db
    .from("portfolio_targets")
    .select("*")
    .eq("user_id", params.userId)
    .eq("portfolio_id", params.portfolioId)
    .eq("target_type", parsedType.data);
  query = targetKey === null ? query.is("target_key", null) : query.eq("target_key", targetKey);
  const { data: existing, error: findError } = await query.maybeSingle();
  if (findError) {
    throw new AppError("INTERNAL_ERROR", "ターゲットの確認に失敗しました。", 500, findError);
  }

  const payload = {
    target_key: targetKey,
    target_percent: params.targetPercent,
    tolerance_percent: params.tolerancePercent,
  };

  const result = existing
    ? await db
        .from("portfolio_targets")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", params.userId)
        .select("*")
        .single()
    : await db
        .from("portfolio_targets")
        .insert({
          user_id: params.userId,
          portfolio_id: params.portfolioId,
          target_type: parsedType.data,
          ...payload,
        })
        .select("*")
        .single();

  if (result.error || !result.data) {
    throw new AppError("INTERNAL_ERROR", "ターゲットの保存に失敗しました。", 500, result.error);
  }

  return { target: result.data as PortfolioTarget };
}

export async function deleteTarget(params: { userId: string; targetId: string }) {
  const db = await createDatabaseClient();
  const { data: target, error: findError } = await db
    .from("portfolio_targets")
    .select("id")
    .eq("id", params.targetId)
    .eq("user_id", params.userId)
    .single();
  if (findError || !target) {
    throw new AppError("NOT_FOUND", "ターゲットが見つかりません。", 404);
  }

  const { error } = await db
    .from("portfolio_targets")
    .delete()
    .eq("id", params.targetId)
    .eq("user_id", params.userId);
  if (error) {
    throw new AppError("INTERNAL_ERROR", "ターゲットの削除に失敗しました。", 500, error);
  }
  return { deleted: true };
}
