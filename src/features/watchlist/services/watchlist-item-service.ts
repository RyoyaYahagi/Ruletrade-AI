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

export async function getWatchlistItem(params: {
  userId: string;
  itemId: string;
}) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("watchlist_items")
    .select("*")
    .eq("id", params.itemId)
    .eq("user_id", params.userId)
    .single();

  if (error || !data) {
    throw new AppError(
      "NOT_FOUND",
      "Watchlist itemが見つかりませんでした。",
      404,
      error,
    );
  }

  return { item: data };
}

export async function updateWatchlistItem(params: {
  userId: string;
  itemId: string;
  ticker?: string;
  companyName?: string;
  market?: string;
  currency?: string;
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

  // First, verify the item belongs to the user
  const { data: existing, error: findError } = await supabase
    .from("watchlist_items")
    .select("id")
    .eq("id", params.itemId)
    .eq("user_id", params.userId)
    .single();

  if (findError || !existing) {
    throw new AppError(
      "NOT_FOUND",
      "Watchlist itemが見つかりませんでした。",
      404,
      findError,
    );
  }

  const updateData: Record<string, unknown> = {};
  if (params.ticker !== undefined) updateData.ticker = params.ticker;
  if (params.companyName !== undefined) updateData.company_name = params.companyName;
  if (params.market !== undefined) updateData.market = params.market;
  if (params.currency !== undefined) updateData.currency = params.currency;
  if (params.status !== undefined) updateData.status = params.status;
  if (params.priority !== undefined) updateData.priority = params.priority;
  if (params.interestReason !== undefined) updateData.interest_reason = params.interestReason;
  if (params.targetPriceMin !== undefined) updateData.target_price_min = params.targetPriceMin;
  if (params.targetPriceMax !== undefined) updateData.target_price_max = params.targetPriceMax;
  if (params.plannedTranches !== undefined) updateData.planned_tranches = params.plannedTranches;
  if (params.targetMultiple !== undefined) updateData.target_multiple = params.targetMultiple;
  if (params.maxPositionPercent !== undefined) updateData.max_position_percent = params.maxPositionPercent;
  if (params.stopLossNote !== undefined) updateData.stop_loss_note = params.stopLossNote;
  if (params.takeProfitNote !== undefined) updateData.take_profit_note = params.takeProfitNote;
  if (params.earningsNote !== undefined) updateData.earnings_note = params.earningsNote;
  if (params.researchNotes !== undefined) updateData.research_notes = params.researchNotes;
  if (params.tags !== undefined) updateData.tags = params.tags;
  if (params.ruleSessionId !== undefined) updateData.rule_session_id = params.ruleSessionId;

  const { data: updated, error: updateError } = await supabase
    .from("watchlist_items")
    .update(updateData)
    .eq("id", params.itemId)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Watchlist itemの更新に失敗しました。",
      500,
      updateError,
    );
  }

  return { item: updated };
}

export async function deleteWatchlistItem(params: {
  userId: string;
  itemId: string;
}): Promise<void> {
  const supabase = await createServerClient();

  // First, verify the item belongs to the user
  const { data: existing, error: findError } = await supabase
    .from("watchlist_items")
    .select("id")
    .eq("id", params.itemId)
    .eq("user_id", params.userId)
    .single();

  if (findError || !existing) {
    throw new AppError(
      "NOT_FOUND",
      "Watchlist itemが見つかりませんでした。",
      404,
      findError,
    );
  }

  const { error: deleteError } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", params.itemId);

  if (deleteError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Watchlist itemの削除に失敗しました。",
      500,
      deleteError,
    );
  }
}
