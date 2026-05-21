import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import type {
  VirtualTrade,
  VirtualTradeStatus,
  VirtualTradeType,
} from "@/schemas/education/practice-mode-schema";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type CreateVirtualTradeInput = {
  practice_session_id: string;
  user_id: string;
  symbol: string;
  symbol_name?: string | null;
  trade_type: VirtualTradeType;
  quantity: number;
  entry_price: number;
  virtual_amount: number;
  trade_reason?: string | null;
  rule_compliance_score?: number | null;
  compliance_notes?: string | null;
};

export type UpdateVirtualTradeInput = {
  tradeId: string;
  userId: string;
  trade_reason?: string | null;
  rule_compliance_score?: number | null;
  compliance_notes?: string | null;
};

export type ListVirtualTradesFilters = {
  practiceSessionId: string;
  userId: string;
  status?: VirtualTradeStatus;
  limit?: number;
};

// ──────────────────────────────────────────────
// createVirtualTrade
// ──────────────────────────────────────────────

/**
 * Create a new virtual trade within a practice session.
 *
 * Inserts a row in `virtual_trades` with the provided details.
 * The trade starts in `"open"` status by default.
 */
export async function createVirtualTrade(input: CreateVirtualTradeInput) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("virtual_trades")
    .insert({
      practice_session_id: input.practice_session_id,
      user_id: input.user_id,
      symbol: input.symbol,
      symbol_name: input.symbol_name ?? null,
      trade_type: input.trade_type,
      quantity: input.quantity,
      entry_price: input.entry_price,
      virtual_amount: input.virtual_amount,
      trade_reason: input.trade_reason ?? null,
      rule_compliance_score: input.rule_compliance_score ?? null,
      compliance_notes: input.compliance_notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create virtual trade: no data returned.");
  }

  return { data: data as VirtualTrade };
}

// ──────────────────────────────────────────────
// getVirtualTradeById
// ──────────────────────────────────────────────

/**
 * Get a single virtual trade by its `id`, scoped to the given `userId`.
 *
 * Returns `null` if the trade is not found or not accessible.
 */
export async function getVirtualTradeById(id: string, userId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("virtual_trades")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return { data: data as VirtualTrade | null };
}

// ──────────────────────────────────────────────
// listVirtualTrades
// ──────────────────────────────────────────────

/**
 * List virtual trades for a practice session with optional status filtering.
 *
 * Results are ordered by `opened_at` descending (newest first).
 */
export async function listVirtualTrades(filters: ListVirtualTradesFilters) {
  const supabase = await createServerClient();

  let query = supabase
    .from("virtual_trades")
    .select("*")
    .eq("practice_session_id", filters.practiceSessionId)
    .eq("user_id", filters.userId);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  query = query.order("opened_at", { ascending: false });

  if (filters.limit && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as VirtualTrade[] };
}

// ──────────────────────────────────────────────
// updateVirtualTrade
// ──────────────────────────────────────────────

/**
 * Update mutable fields of a virtual trade.
 *
 * Only the record matching `tradeId` AND `userId` is updated.
 * Returns the updated record.
 */
export async function updateVirtualTrade(input: UpdateVirtualTradeInput) {
  const supabase = await createServerClient();

  // Verify the record exists
  const { data: existing, error: findError } = await supabase
    .from("virtual_trades")
    .select("id")
    .eq("id", input.tradeId)
    .eq("user_id", input.userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Virtual trade with id "${input.tradeId}" not found or not accessible.`,
    );
  }

  const payload: Record<string, unknown> = {};

  if (input.trade_reason !== undefined)
    payload.trade_reason = input.trade_reason;
  if (input.rule_compliance_score !== undefined)
    payload.rule_compliance_score = input.rule_compliance_score;
  if (input.compliance_notes !== undefined)
    payload.compliance_notes = input.compliance_notes;

  const { data, error } = await supabase
    .from("virtual_trades")
    .update(payload)
    .eq("id", input.tradeId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Virtual trade with id "${input.tradeId}" not found or could not be updated.`,
    );
  }

  return { data: data as VirtualTrade };
}

// ──────────────────────────────────────────────
// closeVirtualTrade
// ──────────────────────────────────────────────

/**
 * Close an open virtual trade by setting the exit price, calculating realized
 * P&L, and updating status to `"closed"`.
 *
 * Realized P&L is calculated as:
 * - Buy:  (exit_price - entry_price) * quantity
 * - Sell: (entry_price - exit_price) * quantity
 *
 * The trade must currently be in `"open"` status.
 */
export async function closeVirtualTrade(params: {
  tradeId: string;
  userId: string;
  exit_price: number;
  exit_reason?: string | null;
}) {
  const supabase = await createServerClient();

  // Fetch the current trade
  const { data: existing, error: findError } = await supabase
    .from("virtual_trades")
    .select("id, status, trade_type, entry_price, quantity")
    .eq("id", params.tradeId)
    .eq("user_id", params.userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Virtual trade with id "${params.tradeId}" not found or not accessible.`,
    );
  }

  if (existing.status !== "open") {
    throw new Error(
      `Virtual trade with id "${params.tradeId}" is not open (current status: "${existing.status}"). Only open trades can be closed.`,
    );
  }

  // Calculate realized P&L
  const entryPrice = Number(existing.entry_price);
  const exitPrice = Number(params.exit_price);
  const quantity = Number(existing.quantity);

  let realizedPnl: number;
  if (existing.trade_type === "buy") {
    realizedPnl = (exitPrice - entryPrice) * quantity;
  } else {
    realizedPnl = (entryPrice - exitPrice) * quantity;
  }

  const payload: Record<string, unknown> = {
    status: "closed",
    exit_price: exitPrice,
    realized_pnl: realizedPnl,
    closed_at: new Date().toISOString(),
  };

  if (params.exit_reason !== undefined) {
    payload.exit_reason = params.exit_reason;
  }

  const { data, error } = await supabase
    .from("virtual_trades")
    .update(payload)
    .eq("id", params.tradeId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Virtual trade with id "${params.tradeId}" not found or could not be closed.`,
    );
  }

  return { data: data as VirtualTrade };
}

// ──────────────────────────────────────────────
// cancelVirtualTrade
// ──────────────────────────────────────────────

/**
 * Cancel an open virtual trade (sets status to `"cancelled"`).
 *
 * The trade must currently be in `"open"` status.
 */
export async function cancelVirtualTrade(
  tradeId: string,
  userId: string,
  exit_reason?: string | null,
) {
  const supabase = await createServerClient();

  // Fetch the current trade
  const { data: existing, error: findError } = await supabase
    .from("virtual_trades")
    .select("id, status")
    .eq("id", tradeId)
    .eq("user_id", userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Virtual trade with id "${tradeId}" not found or not accessible.`,
    );
  }

  if (existing.status !== "open") {
    throw new Error(
      `Virtual trade with id "${tradeId}" is not open (current status: "${existing.status}"). Only open trades can be cancelled.`,
    );
  }

  const payload: Record<string, unknown> = {
    status: "cancelled",
  };

  if (exit_reason !== undefined) {
    payload.exit_reason = exit_reason;
  }

  const { data, error } = await supabase
    .from("virtual_trades")
    .update(payload)
    .eq("id", tradeId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Virtual trade with id "${tradeId}" not found or could not be cancelled.`,
    );
  }

  return { data: data as VirtualTrade };
}

// ──────────────────────────────────────────────
// deleteVirtualTrade
// ──────────────────────────────────────────────

/**
 * Delete a virtual trade by its `id`, scoped to the given `userId`.
 *
 * Throws if the record is not found or not accessible.
 */
export async function deleteVirtualTrade(
  id: string,
  userId: string,
): Promise<void> {
  const supabase = await createServerClient();

  const { data: existing, error: findError } = await supabase
    .from("virtual_trades")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Virtual trade with id "${id}" not found or not accessible.`,
    );
  }

  const { error } = await supabase
    .from("virtual_trades")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
