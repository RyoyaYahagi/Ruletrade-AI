import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

/**
 * engineering_risk_register テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type EngineeringRisk = {
  id: string;
  risk_key: string;
  title: string;
  description: string;
  risk_area: string;
  likelihood: string;
  impact: string;
  status: string;
  mitigation_plan: string | null;
  owner_user_id: string | null;
  related_debt_key: string | null;
  related_adr_number: number | null;
  related_release_key: string | null;
  created_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateEngineeringRiskInput = {
  risk_key: string;
  title: string;
  description: string;
  risk_area: string;
  likelihood: string;
  impact: string;
  status?: string;
  mitigation_plan?: string | null;
  owner_user_id?: string | null;
  related_debt_key?: string | null;
  related_adr_number?: number | null;
  related_release_key?: string | null;
  created_by?: string | null;
  metadata?: Record<string, unknown>;
};

export type ListEngineeringRisksFilters = {
  status?: string;
  riskArea?: string;
  limit?: number;
};

export type UpdateEngineeringRiskStatusInput = {
  riskId: string;
  status: string;
  closedBy?: string | null;
  closedAt?: string | null;
  mitigationPlan?: string | null;
};

// ──────────────────────────────────────────────
// createEngineeringRisk
// ──────────────────────────────────────────────

/**
 * Create a new engineering risk entry.
 *
 * Inserts a row in `engineering_risk_register` with the provided details.
 *
 * Returns the created engineering risk record.
 */
export async function createEngineeringRisk(input: CreateEngineeringRiskInput) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("engineering_risk_register")
    .insert({
      risk_key: input.risk_key,
      title: input.title,
      description: input.description,
      risk_area: input.risk_area,
      likelihood: input.likelihood,
      impact: input.impact,
      status: input.status ?? "open",
      mitigation_plan: input.mitigation_plan ?? null,
      owner_user_id: input.owner_user_id ?? null,
      related_debt_key: input.related_debt_key ?? null,
      related_adr_number: input.related_adr_number ?? null,
      related_release_key: input.related_release_key ?? null,
      created_by: input.created_by ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create engineering risk: no data returned.");
  }

  return { data: data as EngineeringRisk };
}

// ──────────────────────────────────────────────
// listEngineeringRisks
// ──────────────────────────────────────────────

/**
 * List engineering risks with optional status/riskArea filtering.
 *
 * Supported filters:
 *   - status    (string, exact match)
 *   - riskArea  (string, exact match)
 *   - limit     (number, max results to return)
 *
 * Results are ordered by `created_at` descending (newest first).
 */
export async function listEngineeringRisks(
  filters?: ListEngineeringRisksFilters,
) {
  const db = await createDatabaseClient();

  let query = db.from("engineering_risk_register").select("*");

  // Apply filters
  if (filters) {
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.riskArea) {
      query = query.eq("risk_area", filters.riskArea);
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

  return { data: (data ?? []) as EngineeringRisk[] };
}

// ──────────────────────────────────────────────
// updateEngineeringRiskStatus
// ──────────────────────────────────────────────

/**
 * Update the status of an engineering risk.
 *
 * Looks up the risk by its `id` and updates:
 *   - `status` → the provided status
 *   - `closed_by` → the closer (if provided)
 *   - `closed_at` → the provided timestamp (or current time if omitted and status is "closed")
 *   - `mitigation_plan` → the mitigation plan (if provided)
 *
 * Throws an error if the record is not found.
 *
 * Returns the updated engineering risk record.
 */
export async function updateEngineeringRiskStatus(
  input: UpdateEngineeringRiskStatusInput,
) {
  const db = await createDatabaseClient();

  // Fetch current risk to ensure it exists
  const { data: existing, error: findError } = await db
    .from("engineering_risk_register")
    .select("id, status")
    .eq("id", input.riskId)
    .single();

  if (findError || !existing) {
    throw new Error(`Engineering risk with id "${input.riskId}" not found.`);
  }

  const payload: Record<string, unknown> = {
    status: input.status,
  };

  if (input.closedBy !== undefined && input.closedBy !== null) {
    payload.closed_by = input.closedBy;
  }
  if (input.closedAt !== undefined && input.closedAt !== null) {
    payload.closed_at = input.closedAt;
  } else if (input.status === "closed") {
    // Auto-set closed_at when closing
    payload.closed_at = new Date().toISOString();
  }
  if (input.mitigationPlan !== undefined && input.mitigationPlan !== null) {
    payload.mitigation_plan = input.mitigationPlan;
  }

  const { data, error } = await db
    .from("engineering_risk_register")
    .update(payload)
    .eq("id", input.riskId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Engineering risk with id "${input.riskId}" could not be updated.`,
    );
  }

  return { data: data as EngineeringRisk };
}
