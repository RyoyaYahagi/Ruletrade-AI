import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";

export async function getOrCreateMainWatchlist(params: { userId: string }) {
  const db = await createDatabaseClient();

  const { data: existing, error: findError } = await db
    .from("watchlists")
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Watchlistの取得に失敗しました。",
      500,
      findError,
    );
  }

  if (existing) {
    return { watchlist: existing };
  }

  const { data: created, error: createError } = await db
    .from("watchlists")
    .insert({
      user_id: params.userId,
      name: "Main Watchlist",
      base_currency: "JPY",
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Watchlistの作成に失敗しました。",
      500,
      createError,
    );
  }

  return { watchlist: created };
}

export async function getWatchlist(params: { userId: string }) {
  const { watchlist } = await getOrCreateMainWatchlist({
    userId: params.userId,
  });
  return { watchlist };
}
