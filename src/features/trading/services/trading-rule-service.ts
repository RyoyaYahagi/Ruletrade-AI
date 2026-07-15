import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type TradingRule = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string;
  entry_conditions: unknown;
  exit_conditions: unknown;
  risk_limits: unknown;
  assumptions: unknown;
  evidence: unknown;
  warnings: unknown;
  approval_requirements: unknown;
  natural_language_summary: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  version: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CreateTradingRuleInput = {
  user_id: string;
  name: string;
  description?: string | null;
  status?: string;
  entry_conditions?: unknown;
  exit_conditions?: unknown;
  risk_limits?: unknown;
  assumptions?: unknown;
  evidence?: unknown;
  warnings?: unknown;
  approval_requirements?: unknown;
  natural_language_summary?: string | null;
  created_by?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ListTradingRulesFilters = {
  userId?: string;
  status?: string;
  limit?: number;
};

export type UpdateTradingRuleInput = {
  ruleId: string;
  userId: string;
  name?: string;
  description?: string | null;
  entry_conditions?: unknown;
  exit_conditions?: unknown;
  risk_limits?: unknown;
  assumptions?: unknown;
  evidence?: unknown;
  warnings?: unknown;
  approval_requirements?: unknown;
  natural_language_summary?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type UpdateTradingRuleStatusInput = {
  ruleId: string;
  userId: string;
  status: string;
  actorUserId?: string | null;
};

// ──────────────────────────────────────────────
// createTradingRule
// ──────────────────────────────────────────────

/**
 * Create a new trading rule.
 *
 * Inserts a row in `trading_rules` with the provided details.
 * The `user_id` and `created_by` are set from the input.
 * The `version` defaults to 1 (handled by DB column default).
 *
 * Returns the created trading rule record.
 */
export async function createTradingRule(input: CreateTradingRuleInput) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("trading_rules")
    .insert({
      user_id: input.user_id,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "draft",
      entry_conditions: input.entry_conditions ?? [],
      exit_conditions: input.exit_conditions ?? [],
      risk_limits: input.risk_limits ?? {},
      assumptions: input.assumptions ?? [],
      evidence: input.evidence ?? [],
      warnings: input.warnings ?? [],
      approval_requirements: input.approval_requirements ?? {},
      natural_language_summary: input.natural_language_summary ?? null,
      created_by: input.created_by ?? input.user_id,
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create trading rule: no data returned.");
  }

  return { data: data as TradingRule };
}

// ──────────────────────────────────────────────
// getTradingRuleById
// ──────────────────────────────────────────────

/**
 * Get a single trading rule by its `id`, scoped to the given `userId`.
 *
 * Performs ownership filtering by matching both `id` and `user_id`.
 */
export async function getTradingRuleById(id: string, userId: string) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("trading_rules")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return { data: data as TradingRule | null };
}

// ──────────────────────────────────────────────
// listTradingRules
// ──────────────────────────────────────────────

/**
 * List trading rules with optional status and limit filtering.
 *
 * Supported filters:
 *   - userId (string, required — ownership scoping)
 *   - status (string, exact match, optional)
 *   - limit  (number, max results to return, optional)
 *
 * Results are ordered by `created_at` descending (newest first).
 */
export async function listTradingRules(filters?: ListTradingRulesFilters) {
  const db = await createDatabaseClient();

  let query = db.from("trading_rules").select("*");

  // Apply filters
  if (filters) {
    if (filters.userId) {
      query = query.eq("user_id", filters.userId);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
  }

  // Order: created_at DESC (newest first)
  query = query.order("created_at", { ascending: false });

  // Apply limit if provided
  if (filters?.limit && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as TradingRule[] };
}

// ──────────────────────────────────────────────
// updateTradingRule
// ──────────────────────────────────────────────

/**
 * Update a trading rule's fields.
 *
 * Only the record matching `ruleId` AND `userId` (for ownership scoping) is
 * updated. Returns the updated record.
 *
 * The `version` column is automatically incremented on each update.
 */
export async function updateTradingRule(input: UpdateTradingRuleInput) {
  const db = await createDatabaseClient();

  // Fetch current record to obtain the current version
  const { data: existing, error: findError } = await db
    .from("trading_rules")
    .select("id, version")
    .eq("id", input.ruleId)
    .eq("user_id", input.userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Trading rule with id "${input.ruleId}" not found or not accessible.`,
    );
  }

  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.entry_conditions !== undefined)
    payload.entry_conditions = input.entry_conditions;
  if (input.exit_conditions !== undefined)
    payload.exit_conditions = input.exit_conditions;
  if (input.risk_limits !== undefined) payload.risk_limits = input.risk_limits;
  if (input.assumptions !== undefined) payload.assumptions = input.assumptions;
  if (input.evidence !== undefined) payload.evidence = input.evidence;
  if (input.warnings !== undefined) payload.warnings = input.warnings;
  if (input.approval_requirements !== undefined)
    payload.approval_requirements = input.approval_requirements;
  if (input.natural_language_summary !== undefined)
    payload.natural_language_summary = input.natural_language_summary;
  if (input.metadata !== undefined) payload.metadata = input.metadata;

  // Auto-increment version
  payload.version = existing.version + 1;

  const { data, error } = await db
    .from("trading_rules")
    .update(payload)
    .eq("id", input.ruleId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Trading rule with id "${input.ruleId}" not found or could not be updated.`,
    );
  }

  return { data: data as TradingRule };
}

// ──────────────────────────────────────────────
// updateTradingRuleStatus
// ──────────────────────────────────────────────

/**
 * Update the status of a trading rule.
 *
 * When transitioning to `"approved"`, both `approved_by` and `approved_at`
 * are automatically set:
 *   - `approved_by`  → `actorUserId` (if provided) or the `userId`
 *   - `approved_at`  → current ISO timestamp
 *
 * The `version` column is automatically incremented on status changes.
 *
 * Lookup is performed by `id` AND `user_id` for ownership scoping.
 */
export async function updateTradingRuleStatus(
  input: UpdateTradingRuleStatusInput,
) {
  const db = await createDatabaseClient();

  // Fetch current record to capture existing state
  const { data: existing, error: findError } = await db
    .from("trading_rules")
    .select("id, version, status")
    .eq("id", input.ruleId)
    .eq("user_id", input.userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Trading rule with id "${input.ruleId}" not found or not accessible.`,
    );
  }

  const payload: Record<string, unknown> = {
    status: input.status,
    version: existing.version + 1,
  };

  // Auto-set approved_by and approved_at when transitioning to "approved"
  if (input.status === "approved") {
    payload.approved_by = input.actorUserId ?? input.userId;
    payload.approved_at = new Date().toISOString();
  }

  const { data, error } = await db
    .from("trading_rules")
    .update(payload)
    .eq("id", input.ruleId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Trading rule with id "${input.ruleId}" not found or could not be updated.`,
    );
  }

  return { data: data as TradingRule };
}

// ──────────────────────────────────────────────
// deleteTradingRule
// ──────────────────────────────────────────────

/**
 * Delete a trading rule by its `id`, scoped to the given `userId`.
 *
 * Throws if the record is not found or not accessible.
 */
export async function deleteTradingRule(
  id: string,
  userId: string,
): Promise<void> {
  const db = await createDatabaseClient();

  // First verify the record exists and is accessible
  const { data: existing, error: findError } = await db
    .from("trading_rules")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Trading rule with id "${id}" not found or not accessible.`,
    );
  }

  const { error } = await db
    .from("trading_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
