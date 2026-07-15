import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

/**
 * engineering_decisions テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type EngineeringDecision = {
  id: string;
  adr_number: number;
  decision_key: string;
  title: string;
  status: string;
  decision_area: string;
  file_path: string;
  superseded_by_adr_number: number | null;
  related_issue_key: string | null;
  related_release_key: string | null;
  decided_by: string | null;
  decided_at: string | null;
  summary: string;
  consequences: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateEngineeringDecisionInput = {
  adr_number: number;
  decision_key: string;
  title: string;
  status?: string;
  decision_area: string;
  file_path: string;
  superseded_by_adr_number?: number | null;
  related_issue_key?: string | null;
  related_release_key?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  summary: string;
  consequences?: string | null;
  metadata?: Record<string, unknown>;
};

export type ListEngineeringDecisionsFilters = {
  status?: string;
  decisionArea?: string;
  limit?: number;
};

export type UpdateEngineeringDecisionStatusInput = {
  decisionId: string;
  status: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  supersededByAdrNumber?: number | null;
};

// ──────────────────────────────────────────────
// createEngineeringDecision
// ──────────────────────────────────────────────

/**
 * Create a new engineering decision (ADR).
 *
 * Inserts a row in `engineering_decisions` with the provided details.
 *
 * Returns the created engineering decision record.
 */
export async function createEngineeringDecision(
  input: CreateEngineeringDecisionInput,
) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("engineering_decisions")
    .insert({
      adr_number: input.adr_number,
      decision_key: input.decision_key,
      title: input.title,
      status: input.status ?? "proposed",
      decision_area: input.decision_area,
      file_path: input.file_path,
      superseded_by_adr_number: input.superseded_by_adr_number ?? null,
      related_issue_key: input.related_issue_key ?? null,
      related_release_key: input.related_release_key ?? null,
      decided_by: input.decided_by ?? null,
      decided_at: input.decided_at ?? null,
      summary: input.summary,
      consequences: input.consequences ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create engineering decision: no data returned.");
  }

  return { data: data as EngineeringDecision };
}

// ──────────────────────────────────────────────
// listEngineeringDecisions
// ──────────────────────────────────────────────

/**
 * List engineering decisions with optional status/decisionArea filtering.
 *
 * Supported filters:
 *   - status        (string, exact match)
 *   - decisionArea  (string, exact match)
 *   - limit         (number, max results to return)
 *
 * Results are ordered by `adr_number` descending (newest first).
 */
export async function listEngineeringDecisions(
  filters?: ListEngineeringDecisionsFilters,
) {
  const db = await createDatabaseClient();

  let query = db.from("engineering_decisions").select("*");

  // Apply filters
  if (filters) {
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.decisionArea) {
      query = query.eq("decision_area", filters.decisionArea);
    }
  }

  // Order by adr_number descending (newest first)
  query = query.order("adr_number", { ascending: false });

  // Apply limit if provided
  if (filters?.limit && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as EngineeringDecision[] };
}

// ──────────────────────────────────────────────
// updateEngineeringDecisionStatus
// ──────────────────────────────────────────────

/**
 * Update the status of an engineering decision.
 *
 * Looks up the decision by its `id` and updates:
 *   - `status` → the provided status
 *   - `decided_by` → the decider (if provided)
 *   - `decided_at` → the provided timestamp (or current time if omitted)
 *   - `superseded_by_adr_number` → the superseding ADR number (if provided)
 *
 * Throws an error if the record is not found.
 *
 * Returns the updated engineering decision record.
 */
export async function updateEngineeringDecisionStatus(
  input: UpdateEngineeringDecisionStatusInput,
) {
  const db = await createDatabaseClient();

  // Fetch current decision to ensure it exists
  const { data: existing, error: findError } = await db
    .from("engineering_decisions")
    .select("id, status")
    .eq("id", input.decisionId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Engineering decision with id "${input.decisionId}" not found.`,
    );
  }

  const payload: Record<string, unknown> = {
    status: input.status,
  };

  if (input.decidedBy !== undefined && input.decidedBy !== null) {
    payload.decided_by = input.decidedBy;
  }
  if (input.decidedAt !== undefined && input.decidedAt !== null) {
    payload.decided_at = input.decidedAt;
  } else if (input.status === "accepted" || input.status === "rejected") {
    // Auto-set decided_at when accepting or rejecting
    payload.decided_at = new Date().toISOString();
  }
  if (
    input.supersededByAdrNumber !== undefined &&
    input.supersededByAdrNumber !== null
  ) {
    payload.superseded_by_adr_number = input.supersededByAdrNumber;
  }

  const { data, error } = await db
    .from("engineering_decisions")
    .update(payload)
    .eq("id", input.decisionId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Engineering decision with id "${input.decisionId}" could not be updated.`,
    );
  }

  return { data: data as EngineeringDecision };
}
