import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import type {
  PracticeRule,
  PracticeRuleType,
} from "@/schemas/education/practice-mode-schema";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type CreatePracticeRuleInput = {
  practice_session_id: string;
  user_id: string;
  rule_name: string;
  rule_type: PracticeRuleType;
  condition_description: string;
  max_position_ratio?: number | null;
  max_loss_amount?: number | null;
};

export type UpdatePracticeRuleInput = {
  ruleId: string;
  userId: string;
  rule_name?: string;
  rule_type?: PracticeRuleType;
  condition_description?: string;
  max_position_ratio?: number | null;
  max_loss_amount?: number | null;
};

export type ListPracticeRulesFilters = {
  practiceSessionId: string;
  userId: string;
  rule_type?: PracticeRuleType;
  is_active?: boolean;
  limit?: number;
};

// ──────────────────────────────────────────────
// createPracticeRule
// ──────────────────────────────────────────────

/**
 * Create a new practice rule for a session.
 *
 * Inserts a row in `practice_rules` with the provided details.
 * The rule starts as active by default.
 */
export async function createPracticeRule(input: CreatePracticeRuleInput) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("practice_rules")
    .insert({
      practice_session_id: input.practice_session_id,
      user_id: input.user_id,
      rule_name: input.rule_name,
      rule_type: input.rule_type,
      condition_description: input.condition_description,
      max_position_ratio: input.max_position_ratio ?? null,
      max_loss_amount: input.max_loss_amount ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create practice rule: no data returned.");
  }

  return { data: data as PracticeRule };
}

// ──────────────────────────────────────────────
// getPracticeRuleById
// ──────────────────────────────────────────────

/**
 * Get a single practice rule by its `id`, scoped to the given `userId`.
 *
 * Returns `null` if the rule is not found or not accessible.
 */
export async function getPracticeRuleById(id: string, userId: string) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("practice_rules")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return { data: data as PracticeRule | null };
}

// ──────────────────────────────────────────────
// listPracticeRules
// ──────────────────────────────────────────────

/**
 * List practice rules for a session with optional filtering by type or
 * active status.
 *
 * Results are ordered by `created_at` descending (newest first).
 */
export async function listPracticeRules(filters: ListPracticeRulesFilters) {
  const db = await createDatabaseClient();

  let query = db
    .from("practice_rules")
    .select("*")
    .eq("practice_session_id", filters.practiceSessionId)
    .eq("user_id", filters.userId);

  if (filters.rule_type) {
    query = query.eq("rule_type", filters.rule_type);
  }

  if (filters.is_active !== undefined) {
    query = query.eq("is_active", filters.is_active);
  }

  query = query.order("created_at", { ascending: false });

  if (filters.limit && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as PracticeRule[] };
}

// ──────────────────────────────────────────────
// updatePracticeRule
// ──────────────────────────────────────────────

/**
 * Update a practice rule's mutable fields.
 *
 * Only the record matching `ruleId` AND `userId` is updated.
 * Returns the updated record.
 */
export async function updatePracticeRule(input: UpdatePracticeRuleInput) {
  const db = await createDatabaseClient();

  // Verify the record exists
  const { data: existing, error: findError } = await db
    .from("practice_rules")
    .select("id")
    .eq("id", input.ruleId)
    .eq("user_id", input.userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Practice rule with id "${input.ruleId}" not found or not accessible.`,
    );
  }

  const payload: Record<string, unknown> = {};

  if (input.rule_name !== undefined) payload.rule_name = input.rule_name;
  if (input.rule_type !== undefined) payload.rule_type = input.rule_type;
  if (input.condition_description !== undefined)
    payload.condition_description = input.condition_description;
  if (input.max_position_ratio !== undefined)
    payload.max_position_ratio = input.max_position_ratio;
  if (input.max_loss_amount !== undefined)
    payload.max_loss_amount = input.max_loss_amount;

  const { data, error } = await db
    .from("practice_rules")
    .update(payload)
    .eq("id", input.ruleId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Practice rule with id "${input.ruleId}" not found or could not be updated.`,
    );
  }

  return { data: data as PracticeRule };
}

// ──────────────────────────────────────────────
// togglePracticeRuleActive
// ──────────────────────────────────────────────

/**
 * Toggle the `is_active` flag on a practice rule.
 *
 * Useful for enabling/disabling a rule without deleting it.
 */
export async function togglePracticeRuleActive(
  ruleId: string,
  userId: string,
  is_active: boolean,
) {
  const db = await createDatabaseClient();

  // Verify the record exists
  const { data: existing, error: findError } = await db
    .from("practice_rules")
    .select("id")
    .eq("id", ruleId)
    .eq("user_id", userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Practice rule with id "${ruleId}" not found or not accessible.`,
    );
  }

  const { data, error } = await db
    .from("practice_rules")
    .update({ is_active })
    .eq("id", ruleId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Practice rule with id "${ruleId}" not found or could not be updated.`,
    );
  }

  return { data: data as PracticeRule };
}

// ──────────────────────────────────────────────
// deletePracticeRule
// ──────────────────────────────────────────────

/**
 * Delete a practice rule by its `id`, scoped to the given `userId`.
 *
 * Throws if the record is not found or not accessible.
 */
export async function deletePracticeRule(
  id: string,
  userId: string,
): Promise<void> {
  const db = await createDatabaseClient();

  const { data: existing, error: findError } = await db
    .from("practice_rules")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Practice rule with id "${id}" not found or not accessible.`,
    );
  }

  const { error } = await db
    .from("practice_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
