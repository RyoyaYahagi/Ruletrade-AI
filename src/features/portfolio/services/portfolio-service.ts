import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";

export async function getOrCreateMainPortfolio(params: { userId: string }) {
  const supabase = await createServerClient();

  const { data: existing, error: findError } = await supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ポートフォリオの取得に失敗しました。",
      500,
      findError,
    );
  }

  if (existing) {
    return { portfolio: existing };
  }

  const { data: created, error: createError } = await supabase
    .from("portfolios")
    .insert({
      user_id: params.userId,
      name: "Main Portfolio",
      base_currency: "JPY",
      cash_amount: 0,
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ポートフォリオの作成に失敗しました。",
      500,
      createError,
    );
  }

  return { portfolio: created };
}

export async function getPortfolio(params: { userId: string }) {
  const { portfolio } = await getOrCreateMainPortfolio({
    userId: params.userId,
  });
  return { portfolio };
}
