import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

/**
 * architecture_review_requests テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type ArchitectureReviewRequest = {
  id: string;
  request_key: string;
  title: string;
  description: string | null;
  review_area: string;
  status: string;
  risk_level: string;
  requires_adr: boolean;
  adr_number: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
  requested_at: string | null;
  reviewed_at: string | null;
  decision_summary: string | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CreateArchitectureReviewRequestInput = {
  request_key: string;
  title: string;
  description?: string | null;
  review_area: string;
  status?: string;
  risk_level?: string;
  requires_adr?: boolean;
  adr_number?: string | null;
  requested_by?: string | null;
  requested_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ListArchitectureReviewRequestsFilters = {
  status?: string;
  reviewArea?: string;
  limit?: number;
};

export type UpdateArchitectureReviewStatusInput = {
  requestId: string;
  status: string;
  reviewedBy: string;
  decisionSummary?: string | null;
};

// ──────────────────────────────────────────────
// createArchitectureReviewRequest
// ──────────────────────────────────────────────

/**
 * Create a new architecture review request.
 *
 * Inserts a row in `architecture_review_requests` with the provided details.
 *
 * Returns the created architecture review request record.
 */
export async function createArchitectureReviewRequest(
  input: CreateArchitectureReviewRequestInput,
) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("architecture_review_requests")
    .insert({
      request_key: input.request_key,
      title: input.title,
      description: input.description ?? null,
      review_area: input.review_area,
      status: input.status ?? "pending",
      risk_level: input.risk_level ?? "medium",
      requires_adr: input.requires_adr ?? false,
      adr_number: input.adr_number ?? null,
      requested_by: input.requested_by ?? null,
      requested_at: input.requested_at ?? new Date().toISOString(),
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "Failed to create architecture review request: no data returned.",
    );
  }

  return { data: data as ArchitectureReviewRequest };
}

// ──────────────────────────────────────────────
// listArchitectureReviewRequests
// ──────────────────────────────────────────────

/**
 * List architecture review requests with optional status/reviewArea filtering.
 *
 * Supported filters:
 *   - status      (string, exact match)
 *   - reviewArea  (string, exact match)
 *   - limit       (number, max results to return)
 *
 * Results are ordered by `requested_at` descending (newest first).
 */
export async function listArchitectureReviewRequests(
  filters?: ListArchitectureReviewRequestsFilters,
) {
  const db = await createDatabaseClient();

  let query = db.from("architecture_review_requests").select("*");

  // Apply filters
  if (filters) {
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.reviewArea) {
      query = query.eq("review_area", filters.reviewArea);
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

  return { data: (data ?? []) as ArchitectureReviewRequest[] };
}

// ──────────────────────────────────────────────
// updateArchitectureReviewStatus
// ──────────────────────────────────────────────

/**
 * Update the status of an architecture review request.
 *
 * Looks up the request by its `id` and updates:
 *   - `status` → the provided status
 *   - `reviewed_by` → the reviewer
 *   - `reviewed_at` → current ISO timestamp
 *   - `decision_summary` → the optionally provided summary
 *
 * Throws an error if the record is not found.
 *
 * Returns the updated architecture review request record.
 */
export async function updateArchitectureReviewStatus(
  input: UpdateArchitectureReviewStatusInput,
) {
  const db = await createDatabaseClient();

  // Fetch current request to ensure it exists
  const { data: existing, error: findError } = await db
    .from("architecture_review_requests")
    .select("id, status")
    .eq("id", input.requestId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Architecture review request with id "${input.requestId}" not found.`,
    );
  }

  const payload: Record<string, unknown> = {
    status: input.status,
    reviewed_by: input.reviewedBy,
    reviewed_at: new Date().toISOString(),
  };

  if (input.decisionSummary !== undefined && input.decisionSummary !== null) {
    payload.decision_summary = input.decisionSummary;
  }

  const { data, error } = await db
    .from("architecture_review_requests")
    .update(payload)
    .eq("id", input.requestId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Architecture review request with id "${input.requestId}" could not be updated.`,
    );
  }

  return { data: data as ArchitectureReviewRequest };
}
