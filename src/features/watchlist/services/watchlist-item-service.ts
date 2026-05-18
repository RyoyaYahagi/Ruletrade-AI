import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { getOrCreateMainWatchlist } from "@/features/watchlist/services/watchlist-service";

export async function listWatchlistItems(params: { userId: string }) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("watchlist_items")
    .select("*")
    .eq("user_id", params.userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Watchlist item一覧の取得に失敗しました。",
      500,
      error,
    );
  }

  return { items: data ?? [] };
}

export async function createWatchlistItem(params: {
  userId: string;
  ticker: string;
  companyName?: string;
  market?: string;
  currency: string;
  status?: string;
  priority?: string;
  interestReason?: string;
  targetPriceMin?: number;
  targetPriceMax?: number;
  plannedTranches?: number;
  targetMultiple?: number;
  maxPositionPercent?: number;
  stopLossNote?: string;
  takeProfitNote?: string;
  earningsNote?: string;
  researchNotes?: string;
  tags?: string[];
  ruleSessionId?: string;
}) {
  const supabase = await createServerClient();

  const { watchlist } = await getOrCreateMainWatchlist({
    userId: params.userId,
  });

  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({
      user_id: params.userId,
      watchlist_id: watchlist.id,
      ticker: params.ticker,
      company_name: params.companyName ?? null,
      market: params.market ?? null,
      currency: params.currency,
      status: params.status ?? "watching",
      priority: params.priority ?? "medium",
      interest_reason: params.interestReason ?? null,
      target_price_min: params.targetPriceMin ?? null,
      target_price_max: params.targetPriceMax ?? null,
      planned_tranches: params.plannedTranches ?? null,
      target_multiple: params.targetMultiple ?? null,
      max_position_percent: params.maxPositionPercent ?? null,
      stop_loss_note: params.stopLossNote ?? null,
      take_profit_note: params.takeProfitNote ?? null,
      earnings_note: params.earningsNote ?? null,
      research_notes: params.researchNotes ?? null,
      tags: params.tags ?? [],
      rule_session_id: params.ruleSessionId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Watchlist itemの追加に失敗しました。",
      500,
      error,
    );
  }

  return { item: data };
}
