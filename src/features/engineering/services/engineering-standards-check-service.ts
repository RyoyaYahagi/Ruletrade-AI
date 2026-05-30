import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

/**
 * engineering_standards_checks テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type EngineeringStandardsCheck = {
  id: string;
  check_key: string;
  check_type: string;
  status: string;
  target_type: string | null;
  target_id: string | null;
  findings: Record<string, unknown>[];
  checked_by: string | null;
  checked_at: string;
  created_at: string;
};

export type CreateStandardsCheckInput = {
  check_key: string;
  check_type: string;
  status?: string;
  target_type?: string | null;
  target_id?: string | null;
  findings?: Record<string, unknown>[];
  checked_by?: string | null;
};

export type ListStandardsChecksFilters = {
  checkType?: string;
  status?: string;
  limit?: number;
};

export type UpdateStandardsCheckStatusInput = {
  checkId: string;
  status: string;
  checkedBy?: string | null;
  findings?: Record<string, unknown>[] | null;
};

// ──────────────────────────────────────────────
// createStandardsCheck
// ──────────────────────────────────────────────

/**
 * Create a new engineering standards check.
 *
 * Inserts a row in `engineering_standards_checks` with the provided details.
 *
 * Returns the created engineering standards check record.
 */
export async function createStandardsCheck(input: CreateStandardsCheckInput) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("engineering_standards_checks")
    .insert({
      check_key: input.check_key,
      check_type: input.check_type,
      status: input.status ?? "not_checked",
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      findings: input.findings ?? [],
      checked_by: input.checked_by ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create standards check: no data returned.");
  }

  return { data: data as EngineeringStandardsCheck };
}

// ──────────────────────────────────────────────
// listStandardsChecks
// ──────────────────────────────────────────────

/**
 * List engineering standards checks with optional checkType/status filtering.
 *
 * Supported filters:
 *   - checkType  (string, exact match)
 *   - status     (string, exact match)
 *   - limit      (number, max results to return)
 *
 * Results are ordered by `created_at` descending (newest first).
 */
export async function listStandardsChecks(
  filters?: ListStandardsChecksFilters,
) {
  const supabase = await createServerClient();

  let query = supabase.from("engineering_standards_checks").select("*");

  // Apply filters
  if (filters) {
    if (filters.checkType) {
      query = query.eq("check_type", filters.checkType);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
  }

  // Order by created_at descending (newest first)
  query = query.order("created_at", { ascending: false });

  // Apply limit if provided
  if (filters?.limit && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as EngineeringStandardsCheck[] };
}

// ──────────────────────────────────────────────
// updateStandardsCheckStatus
// ──────────────────────────────────────────────

/**
 * Update the status of an engineering standards check.
 *
 * Looks up the check by its `id` and updates:
 *   - `status` → the provided status
 *   - `checked_by` → the checker (if provided)
 *   - `findings` → the findings array (if provided)
 *
 * Throws an error if the record is not found.
 *
 * Returns the updated engineering standards check record.
 */
export async function updateStandardsCheckStatus(
  input: UpdateStandardsCheckStatusInput,
) {
  const supabase = await createServerClient();

  // Fetch current check to ensure it exists
  const { data: existing, error: findError } = await supabase
    .from("engineering_standards_checks")
    .select("id, status")
    .eq("id", input.checkId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Engineering standards check with id "${input.checkId}" not found.`,
    );
  }

  const payload: Record<string, unknown> = {
    status: input.status,
  };

  if (input.checkedBy !== undefined && input.checkedBy !== null) {
    payload.checked_by = input.checkedBy;
  }
  if (input.findings !== undefined && input.findings !== null) {
    payload.findings = input.findings;
  }

  const { data, error } = await supabase
    .from("engineering_standards_checks")
    .update(payload)
    .eq("id", input.checkId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Engineering standards check with id "${input.checkId}" could not be updated.`,
    );
  }

  return { data: data as EngineeringStandardsCheck };
}
