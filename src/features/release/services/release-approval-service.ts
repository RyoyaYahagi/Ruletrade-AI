import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

/**
 * release_approvals テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type ReleaseApproval = {
  id: string;
  release_plan_id: string;
  approver_user_id: string;
  approval_status: string;
  approval_type: string;
  comment: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateReleaseApprovalInput = {
  release_plan_id: string;
  approver_user_id: string;
  approval_status?: string;
  approval_type: string;
  comment?: string;
  decided_at?: string | null;
};

export type UpdateApprovalStatusInput = {
  approval_status: string;
  comment?: string | null;
  decided_at?: string | null;
};

// ──────────────────────────────────────────────
// createReleaseApproval
// ──────────────────────────────────────────────

/**
 * Create a new release approval record.
 *
 * Creates a row in `release_approvals` for the given release plan and approver.
 * The `approval_status` defaults to `"pending"` if not provided.
 * If `decided_at` is not provided and `approval_status` is a terminal value
 * (`"approved"` or `"rejected"`), it is automatically set to the current ISO
 * timestamp.
 */
export async function createReleaseApproval(
  input: CreateReleaseApprovalInput,
) {
  const supabase = await createServerClient();

  // Auto-set decided_at when transitioning to a terminal status
  let decidedAt = input.decided_at;
  if (decidedAt === undefined) {
    if (
      input.approval_status === "approved" ||
      input.approval_status === "rejected"
    ) {
      decidedAt = new Date().toISOString();
    } else {
      decidedAt = null;
    }
  }

  const { data, error } = await supabase
    .from("release_approvals")
    .insert({
      release_plan_id: input.release_plan_id,
      approver_user_id: input.approver_user_id,
      approval_status: input.approval_status ?? "pending",
      approval_type: input.approval_type,
      comment: input.comment ?? null,
      decided_at: decidedAt,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create release approval: no data returned.");
  }

  return { data: data as ReleaseApproval };
}

// ──────────────────────────────────────────────
// listApprovalsByReleasePlan
// ──────────────────────────────────────────────

/**
 * List all release approvals for a given release plan.
 *
 * Results are ordered by `created_at` ascending (oldest first).
 */
export async function listApprovalsByReleasePlan(releasePlanId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("release_approvals")
    .select("*")
    .eq("release_plan_id", releasePlanId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return { data: (data ?? []) as ReleaseApproval[] };
}

// ──────────────────────────────────────────────
// updateApprovalStatus
// ──────────────────────────────────────────────

/**
 * Update the approval status of a single release approval record.
 *
 * When the status changes to `"approved"` or `"rejected"`, `decided_at` is
 * automatically set to the current ISO timestamp unless an explicit value is
 * provided in `input.decided_at`. If `comment` is provided, it is persisted on
 * the record.
 *
 * Lookup is performed by the record's `id`.
 */
export async function updateApprovalStatus(
  approvalId: string,
  input: UpdateApprovalStatusInput,
) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {
    approval_status: input.approval_status,
  };

  // Auto-set decided_at when transitioning to a terminal status
  if (input.decided_at !== undefined) {
    payload.decided_at = input.decided_at;
  } else if (
    input.approval_status === "approved" ||
    input.approval_status === "rejected"
  ) {
    payload.decided_at = new Date().toISOString();
  }

  // Persist comment if provided
  if (input.comment !== undefined) {
    payload.comment = input.comment;
  }

  const { data, error } = await supabase
    .from("release_approvals")
    .update(payload)
    .eq("id", approvalId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Release approval with id "${approvalId}" not found or could not be updated.`,
    );
  }

  return { data: data as ReleaseApproval };
}
