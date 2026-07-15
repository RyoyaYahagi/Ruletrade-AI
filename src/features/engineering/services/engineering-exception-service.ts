import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

/**
 * engineering_exceptions テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type EngineeringException = {
  id: string;
  exception_key: string;
  title: string;
  description: string | null;
  exception_type: string;
  status: string;
  risk_level: string;
  requested_by: string | null;
  approved_by: string | null;
  requested_at: string | null;
  approved_at: string | null;
  expires_at: string | null;
  mitigation: string | null;
  follow_up_debt_key: string | null;
  related_issue_key: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CreateEngineeringExceptionInput = {
  exception_key: string;
  title: string;
  description?: string | null;
  exception_type: string;
  status?: string;
  risk_level?: string;
  requested_by?: string | null;
  requested_at?: string | null;
  expires_at?: string | null;
  mitigation?: string | null;
  follow_up_debt_key?: string | null;
  related_issue_key?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ListEngineeringExceptionsFilters = {
  status?: string;
  limit?: number;
};

export type ApproveEngineeringExceptionInput = {
  exceptionId: string;
  approvedBy: string;
  approvedAt?: string;
};

// ──────────────────────────────────────────────
// createEngineeringException
// ──────────────────────────────────────────────

/**
 * Create a new engineering exception.
 *
 * Inserts a row in `engineering_exceptions` with the provided details.
 *
 * When the environment variable `ENGINEERING_REQUIRE_EXCEPTION_EXPIRY` is
 * set to `"true"`, `expires_at` is required — an error is thrown if it is
 * not provided.
 *
 * Returns the created exception record.
 */
export async function createEngineeringException(
  input: CreateEngineeringExceptionInput,
) {
  const requireExpiry =
    process.env.ENGINEERING_REQUIRE_EXCEPTION_EXPIRY === "true";

  if (requireExpiry && !input.expires_at) {
    throw new Error(
      "expires_at is required when ENGINEERING_REQUIRE_EXCEPTION_EXPIRY=true",
    );
  }

  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("engineering_exceptions")
    .insert({
      exception_key: input.exception_key,
      title: input.title,
      description: input.description ?? null,
      exception_type: input.exception_type,
      status: input.status ?? "open",
      risk_level: input.risk_level ?? "medium",
      requested_by: input.requested_by ?? null,
      requested_at: input.requested_at ?? new Date().toISOString(),
      expires_at: input.expires_at ?? null,
      mitigation: input.mitigation ?? null,
      follow_up_debt_key: input.follow_up_debt_key ?? null,
      related_issue_key: input.related_issue_key ?? null,
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "Failed to create engineering exception: no data returned.",
    );
  }

  return { data: data as EngineeringException };
}

// ──────────────────────────────────────────────
// listEngineeringExceptions
// ──────────────────────────────────────────────

/**
 * List engineering exceptions with optional status filtering.
 *
 * Supported filters:
 *   - status  (string, exact match)
 *   - limit   (number, max results to return)
 *
 * Results are ordered by `requested_at` descending (newest first).
 */
export async function listEngineeringExceptions(
  filters?: ListEngineeringExceptionsFilters,
) {
  const db = await createDatabaseClient();

  let query = db.from("engineering_exceptions").select("*");

  // Apply filters
  if (filters) {
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
  }

  // Order by requested_at descending (newest first)
  query = query.order("requested_at", { ascending: false });

  // Apply limit if provided
  if (filters?.limit && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as EngineeringException[] };
}

// ──────────────────────────────────────────────
// approveEngineeringException
// ──────────────────────────────────────────────

/**
 * Approve an engineering exception.
 *
 * Looks up the exception by its `id` and updates:
 *   - `status` → `"approved"`
 *   - `approved_by` → the provided approver
 *   - `approved_at` → the provided timestamp (or current time if omitted)
 *
 * Throws an error if the record is not found.
 *
 * Returns the updated exception record.
 */
export async function approveEngineeringException(
  input: ApproveEngineeringExceptionInput,
) {
  const db = await createDatabaseClient();

  // Fetch current exception to ensure it exists
  const { data: existing, error: findError } = await db
    .from("engineering_exceptions")
    .select("id, status")
    .eq("id", input.exceptionId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Engineering exception with id "${input.exceptionId}" not found.`,
    );
  }

  const payload: Record<string, unknown> = {
    status: "approved",
    approved_by: input.approvedBy,
    approved_at: input.approvedAt ?? new Date().toISOString(),
  };

  const { data, error } = await db
    .from("engineering_exceptions")
    .update(payload)
    .eq("id", input.exceptionId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Engineering exception with id "${input.exceptionId}" could not be updated.`,
    );
  }

  return { data: data as EngineeringException };
}
