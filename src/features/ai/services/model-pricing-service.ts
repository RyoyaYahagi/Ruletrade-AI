import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";

export async function listModelPricing() {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("model_pricing_configs")
    .select("*")
    .order("provider")
    .order("model")
    .order("effective_from", { ascending: false });

  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "モデル単価表の取得に失敗しました。",
      500,
      error,
    );
  }

  return { pricing: data ?? [] };
}

export async function addModelPricing(params: {
  provider: string;
  model: string;
  inputCostPer1mTokensUsd: number;
  outputCostPer1mTokensUsd: number;
  effectiveFrom: string;
}) {
  const db = await createDatabaseClient();
  const { data: existing, error: findError } = await db
    .from("model_pricing_configs")
    .select("id")
    .eq("provider", params.provider)
    .eq("model", params.model);

  if (findError) {
    throw new AppError(
      "DATABASE_ERROR",
      "既存のモデル単価の確認に失敗しました。",
      500,
      findError,
    );
  }

  for (const row of existing ?? []) {
    const { error } = await db
      .from("model_pricing_configs")
      .update({ is_active: false })
      .eq("id", row.id);
    if (error) {
      throw new AppError(
        "DATABASE_ERROR",
        "旧モデル単価の無効化に失敗しました。",
        500,
        error,
      );
    }
  }

  const { data, error } = await db
    .from("model_pricing_configs")
    .insert({
      provider: params.provider,
      model: params.model,
      input_cost_per_1m_tokens_usd: params.inputCostPer1mTokensUsd,
      output_cost_per_1m_tokens_usd: params.outputCostPer1mTokensUsd,
      effective_from: params.effectiveFrom,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "DATABASE_ERROR",
      "モデル単価の追加に失敗しました。",
      500,
      error,
    );
  }

  return { pricing: data };
}
