import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

/**
 * release_risk_assessments テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type RiskAssessment = {
  id: string;
  release_plan_id: string;
  risk_area: string;
  risk_level: string;
  description: string;
  mitigation: string | null;
  owner_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CreateRiskAssessmentInput = {
  release_plan_id: string;
  risk_area: string;
  risk_level: string;
  description: string;
  mitigation?: string;
  owner_user_id?: string | null;
  status?: string;
};

export type UpdateRiskAssessmentStatusInput = {
  status: string;
  mitigation?: string | null;
};

// ──────────────────────────────────────────────
// createRiskAssessment
// ──────────────────────────────────────────────

/**
 * Create a new risk assessment record for a release plan.
 *
 * Inserts a row in `release_risk_assessments` with the provided details.
 * `status` defaults to `"open"` if not supplied. Returns the created record.
 */
export async function createRiskAssessment(input: CreateRiskAssessmentInput) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("release_risk_assessments")
    .insert({
      release_plan_id: input.release_plan_id,
      risk_area: input.risk_area,
      risk_level: input.risk_level,
      description: input.description,
      mitigation: input.mitigation ?? null,
      owner_user_id: input.owner_user_id ?? null,
      status: input.status ?? "open",
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create risk assessment: no data returned.");
  }

  return { data: data as RiskAssessment };
}

// ──────────────────────────────────────────────
// listRiskAssessmentsByReleasePlan
// ──────────────────────────────────────────────

/**
 * List all risk assessments for a given release plan.
 *
 * Results are ordered by `risk_level` severity descending
 * (critical → high → medium → low), then by `created_at` ascending.
 */
export async function listRiskAssessmentsByReleasePlan(releasePlanId: string) {
  const db = await createDatabaseClient();

  // Define risk-level ordering via a CASE expression
  const riskLevelOrder = `
    case risk_level
      when 'critical' then 0
      when 'high'     then 1
      when 'medium'   then 2
      when 'low'      then 3
      else                4
    end
  `;

  const { data, error } = await db
    .from("release_risk_assessments")
    .select("*")
    .eq("release_plan_id", releasePlanId)
    .order(riskLevelOrder, { ascending: true, foreignTable: undefined })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return { data: (data ?? []) as RiskAssessment[] };
}

// ──────────────────────────────────────────────
// updateRiskAssessmentStatus
// ──────────────────────────────────────────────

/**
 * Update the status of a single risk assessment record.
 *
 * When the status changes to a mitigated or accepted state (or any other),
 * an optional `mitigation` note can be provided to update the mitigation
 * text simultaneously.
 *
 * Lookup is performed by the record's `id`.
 */
export async function updateRiskAssessmentStatus(
  riskAssessmentId: string,
  input: UpdateRiskAssessmentStatusInput,
) {
  const db = await createDatabaseClient();

  const payload: Record<string, unknown> = {
    status: input.status,
  };

  // Persist mitigation text if provided
  if (input.mitigation !== undefined) {
    payload.mitigation = input.mitigation;
  }

  const { data, error } = await db
    .from("release_risk_assessments")
    .update(payload)
    .eq("id", riskAssessmentId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Risk assessment with id "${riskAssessmentId}" not found or could not be updated.`,
    );
  }

  return { data: data as RiskAssessment };
}
