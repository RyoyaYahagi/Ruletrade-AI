import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type InvestmentMemory = {
  id: string;
  user_id: string;
  risk_tolerance: string | null;
  preferred_markets: unknown;
  time_horizons: unknown;
  rejected_patterns: unknown;
  standing_constraints: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertInvestmentMemoryInput = {
  user_id: string;
  risk_tolerance?: string | null;
  preferred_markets?: unknown;
  time_horizons?: unknown;
  rejected_patterns?: unknown;
  standing_constraints?: unknown;
  notes?: string | null;
};

// ──────────────────────────────────────────────
// getInvestmentMemory
// ──────────────────────────────────────────────

/**
 * Get the investment memory for a given user.
 *
 * Each user has at most one investment memory record.
 * Returns `null` if the user has not set any preferences yet.
 */
export async function getInvestmentMemory(userId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("user_investment_memories")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return { data: data as InvestmentMemory | null };
}

// ──────────────────────────────────────────────
// upsertInvestmentMemory
// ──────────────────────────────────────────────

/**
 * Create or update a user's investment memory.
 *
 * If the user already has a record, it is updated; otherwise a new record
 * is created. This ensures a user always has at most one investment memory.
 *
 * Fields that are `undefined` are left untouched on update, and set to their
 * DB defaults on insert.
 */
export async function upsertInvestmentMemory(
  input: UpsertInvestmentMemoryInput,
) {
  const supabase = await createServerClient();

  // Check if a record already exists for this user
  const { data: existing } = await supabase
    .from("user_investment_memories")
    .select("id")
    .eq("user_id", input.user_id)
    .maybeSingle();

  if (existing) {
    // Update existing record
    const payload: Record<string, unknown> = {};

    if (input.risk_tolerance !== undefined)
      payload.risk_tolerance = input.risk_tolerance;
    if (input.preferred_markets !== undefined)
      payload.preferred_markets = input.preferred_markets;
    if (input.time_horizons !== undefined)
      payload.time_horizons = input.time_horizons;
    if (input.rejected_patterns !== undefined)
      payload.rejected_patterns = input.rejected_patterns;
    if (input.standing_constraints !== undefined)
      payload.standing_constraints = input.standing_constraints;
    if (input.notes !== undefined) payload.notes = input.notes;

    const { data, error } = await supabase
      .from("user_investment_memories")
      .update(payload)
      .eq("id", existing.id)
      .eq("user_id", input.user_id)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error(
        `Failed to update investment memory for user "${input.user_id}".`,
      );
    }

    return { data: data as InvestmentMemory };
  }

  // Insert new record
  const { data, error } = await supabase
    .from("user_investment_memories")
    .insert({
      user_id: input.user_id,
      risk_tolerance: input.risk_tolerance ?? null,
      preferred_markets: input.preferred_markets ?? [],
      time_horizons: input.time_horizons ?? [],
      rejected_patterns: input.rejected_patterns ?? [],
      standing_constraints: input.standing_constraints ?? [],
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Failed to create investment memory for user "${input.user_id}".`,
    );
  }

  return { data: data as InvestmentMemory };
}

// ──────────────────────────────────────────────
// deleteInvestmentMemory
// ──────────────────────────────────────────────

/**
 * Delete a user's investment memory.
 *
 * Throws if no record exists for the given user.
 */
export async function deleteInvestmentMemory(userId: string): Promise<void> {
  const supabase = await createServerClient();

  // Verify the record exists before deleting
  const { data: existing, error: findError } = await supabase
    .from("user_investment_memories")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (findError || !existing) {
    throw new Error(
      `Investment memory for user "${userId}" not found or not accessible.`,
    );
  }

  const { error } = await supabase
    .from("user_investment_memories")
    .delete()
    .eq("id", existing.id)
    .eq("user_id", userId);

  if (error) throw error;
}
