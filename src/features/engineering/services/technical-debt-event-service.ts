import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

/**
 * technical_debt_events テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type TechnicalDebtEvent = {
  id: string;
  debt_item_id: string;
  actor_user_id: string | null;
  event_type: string;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type CreateTechnicalDebtEventInput = {
  debt_item_id: string;
  actor_user_id?: string | null;
  event_type: string;
  old_value?: string | null;
  new_value?: string | null;
  metadata?: Record<string, unknown> | null;
};

// ──────────────────────────────────────────────
// createTechnicalDebtEvent
// ──────────────────────────────────────────────

/**
 * Create a new technical debt event record.
 *
 * Inserts a row in `technical_debt_events` with the provided details.
 * Returns the created record.
 */
export async function createTechnicalDebtEvent(
  input: CreateTechnicalDebtEventInput,
) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("technical_debt_events")
    .insert({
      debt_item_id: input.debt_item_id,
      actor_user_id: input.actor_user_id ?? null,
      event_type: input.event_type,
      old_value: input.old_value ?? null,
      new_value: input.new_value ?? null,
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create technical debt event: no data returned.");
  }

  return { data: data as TechnicalDebtEvent };
}

// ──────────────────────────────────────────────
// listTechnicalDebtEventsByDebtItem
// ──────────────────────────────────────────────

/**
 * List all technical debt events for a given debt item.
 *
 * Results are ordered by `created_at` ascending (oldest first).
 */
export async function listTechnicalDebtEventsByDebtItem(debtItemId: string) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("technical_debt_events")
    .select("*")
    .eq("debt_item_id", debtItemId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return { data: (data ?? []) as TechnicalDebtEvent[] };
}
