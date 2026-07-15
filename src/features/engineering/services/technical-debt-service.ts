import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { createTechnicalDebtEvent } from "@/features/engineering/services/technical-debt-event-service";

/**
 * technical_debt_items テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type TechnicalDebtItem = {
  id: string;
  debt_key: string;
  title: string;
  description: string | null;
  debt_type: string;
  status: string;
  priority: string;
  severity: string;
  area: string;
  owner_user_id: string | null;
  target_milestone_key: string | null;
  target_release_key: string | null;
  due_date: string | null;
  accepted_until: string | null;
  repayment_plan: string | null;
  risk_if_not_fixed: string | null;
  related_issue_key: string | null;
  related_adr_number: string | null;
  created_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CreateTechnicalDebtItemInput = {
  debt_key: string;
  title: string;
  description?: string | null;
  debt_type: string;
  status?: string;
  priority?: string;
  severity?: string;
  area: string;
  owner_user_id?: string | null;
  target_milestone_key?: string | null;
  target_release_key?: string | null;
  due_date?: string | null;
  accepted_until?: string | null;
  repayment_plan?: string | null;
  risk_if_not_fixed?: string | null;
  related_issue_key?: string | null;
  related_adr_number?: string | null;
  created_by?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ListTechnicalDebtItemsFilters = {
  status?: string;
  area?: string;
  limit?: number;
};

export type UpdateTechnicalDebtStatusInput = {
  debtItemId: string;
  status: string;
  actorUserId?: string | null;
};

// ──────────────────────────────────────────────
// createTechnicalDebtItem
// ──────────────────────────────────────────────

/**
 * Create a new technical debt item.
 *
 * Inserts a row in `technical_debt_items` with the provided details.
 * After successful creation, a `"created"` event is recorded via
 * `createTechnicalDebtEvent` to maintain an audit trail.
 *
 * Returns the created debt item record.
 */
export async function createTechnicalDebtItem(
  input: CreateTechnicalDebtItemInput,
) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("technical_debt_items")
    .insert({
      debt_key: input.debt_key,
      title: input.title,
      description: input.description ?? null,
      debt_type: input.debt_type,
      status: input.status ?? "open",
      priority: input.priority ?? "medium",
      severity: input.severity ?? "medium",
      area: input.area,
      owner_user_id: input.owner_user_id ?? null,
      target_milestone_key: input.target_milestone_key ?? null,
      target_release_key: input.target_release_key ?? null,
      due_date: input.due_date ?? null,
      accepted_until: input.accepted_until ?? null,
      repayment_plan: input.repayment_plan ?? null,
      risk_if_not_fixed: input.risk_if_not_fixed ?? null,
      related_issue_key: input.related_issue_key ?? null,
      related_adr_number: input.related_adr_number ?? null,
      created_by: input.created_by ?? null,
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create technical debt item: no data returned.");
  }

  const item = data as TechnicalDebtItem;

  // Record "created" event for audit trail
  await createTechnicalDebtEvent({
    debt_item_id: item.id,
    actor_user_id: input.created_by,
    event_type: "created",
    new_value: item.status,
    metadata: {
      debt_key: item.debt_key,
      title: item.title,
      debt_type: item.debt_type,
      area: item.area,
      priority: item.priority,
      severity: item.severity,
    },
  });

  return { data: item };
}

// ──────────────────────────────────────────────
// listTechnicalDebtItems
// ──────────────────────────────────────────────

/**
 * List technical debt items with optional status/area filtering.
 *
 * Supported filters:
 *   - status  (string, exact match)
 *   - area    (string, exact match)
 *   - limit   (number, max results to return)
 *
 * Results are ordered by `priority` ascending (highest priority first),
 * then by `created_at` descending (newest first).
 *
 * Priority ordering: critical → high → medium → low
 */
export async function listTechnicalDebtItems(
  filters?: ListTechnicalDebtItemsFilters,
) {
  const db = await createDatabaseClient();

  // Define priority ordering via a CASE expression
  const priorityOrder = `
    case priority
      when 'critical' then 0
      when 'high'     then 1
      when 'medium'   then 2
      when 'low'      then 3
      else                4
    end
  `;

  let query = db.from("technical_debt_items").select("*");

  // Apply filters
  if (filters) {
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.area) {
      query = query.eq("area", filters.area);
    }
  }

  // Order: priority ASC (highest first), then created_at DESC (newest first)
  query = query.order(priorityOrder, {
    ascending: true,
    foreignTable: undefined,
  });
  query = query.order("created_at", { ascending: false });

  // Apply limit if provided
  if (filters?.limit && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as TechnicalDebtItem[] };
}

// ──────────────────────────────────────────────
// getTechnicalDebtItemByKey
// ──────────────────────────────────────────────

/**
 * Get a single technical debt item by its unique `debt_key`.
 */
export async function getTechnicalDebtItemByKey(debtKey: string) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("technical_debt_items")
    .select("*")
    .eq("debt_key", debtKey)
    .maybeSingle();

  if (error) throw error;

  return { data: data as TechnicalDebtItem | null };
}

// ──────────────────────────────────────────────
// getTechnicalDebtItemById
// ──────────────────────────────────────────────

/**
 * Get a single technical debt item by its `id`.
 */
export async function getTechnicalDebtItemById(id: string) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("technical_debt_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return { data: data as TechnicalDebtItem | null };
}

// ──────────────────────────────────────────────
// updateTechnicalDebtStatus
// ──────────────────────────────────────────────

/**
 * Update the status of a single technical debt item.
 *
 * When the status changes:
 *   - A `"status_changed"` event is recorded via `createTechnicalDebtEvent`
 *     capturing the old and new status values.
 *   - If the new status is `"paid_down"`, `resolved_at` is automatically
 *     set to the current ISO timestamp and `resolved_by` is set to the
 *     provided `actorUserId` (if given).
 *
 * Lookup is performed by the record's `id`.
 */
export async function updateTechnicalDebtStatus(
  input: UpdateTechnicalDebtStatusInput,
) {
  const db = await createDatabaseClient();

  // Fetch current item to capture old status
  const { data: existing, error: findError } = await db
    .from("technical_debt_items")
    .select("id, status")
    .eq("id", input.debtItemId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Technical debt item with id "${input.debtItemId}" not found.`,
    );
  }

  const oldStatus = existing.status;
  const newStatus = input.status;

  const payload: Record<string, unknown> = {
    status: newStatus,
  };

  // Auto-set resolved_at and resolved_by when transitioning to "paid_down"
  if (newStatus === "paid_down") {
    payload.resolved_at = new Date().toISOString();
    if (input.actorUserId) {
      payload.resolved_by = input.actorUserId;
    }
  }

  const { data, error } = await db
    .from("technical_debt_items")
    .update(payload)
    .eq("id", input.debtItemId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Technical debt item with id "${input.debtItemId}" not found or could not be updated.`,
    );
  }

  // Record "status_changed" event for audit trail
  await createTechnicalDebtEvent({
    debt_item_id: input.debtItemId,
    actor_user_id: input.actorUserId,
    event_type: "status_changed",
    old_value: oldStatus,
    new_value: newStatus,
  });

  return { data: data as TechnicalDebtItem };
}

// ──────────────────────────────────────────────
// deleteTechnicalDebtItem
// ──────────────────────────────────────────────

/**
 * Delete a technical debt item by its `id`.
 *
 * Records a `"deleted"` event before removing the record to maintain
 * an audit trail.
 */
export async function deleteTechnicalDebtItem(
  id: string,
  actorUserId?: string | null,
): Promise<void> {
  const db = await createDatabaseClient();

  // Record "deleted" event before removal
  await createTechnicalDebtEvent({
    debt_item_id: id,
    actor_user_id: actorUserId,
    event_type: "deleted",
  });

  const { error } = await db
    .from("technical_debt_items")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
