import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import type {
  PracticeSession,
  PracticeSessionStatus,
} from "@/schemas/education/practice-mode-schema";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type CreatePracticeSessionInput = {
  user_id: string;
  name?: string;
  description?: string | null;
  virtual_balance?: number;
  starting_balance?: number;
  currency?: string;
  lesson_plan?: string | null;
  target_duration_days?: number | null;
};

export type UpdatePracticeSessionInput = {
  sessionId: string;
  userId: string;
  name?: string;
  description?: string | null;
  virtual_balance?: number;
  lesson_plan?: string | null;
  target_duration_days?: number | null;
};

export type ListUserSessionsFilters = {
  userId: string;
  status?: PracticeSessionStatus;
  limit?: number;
};

// ──────────────────────────────────────────────
// createPracticeSession
// ──────────────────────────────────────────────

/**
 * Create a new practice session for a user.
 *
 * Inserts a row in `practice_sessions` with the provided details.
 * The `virtual_balance` and `starting_balance` default to 1,000,000.
 */
export async function createPracticeSession(input: CreatePracticeSessionInput) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("practice_sessions")
    .insert({
      user_id: input.user_id,
      name: input.name ?? "Practice Session",
      description: input.description ?? null,
      virtual_balance: input.virtual_balance ?? 1000000,
      starting_balance: input.starting_balance ?? 1000000,
      currency: input.currency ?? "JPY",
      lesson_plan: input.lesson_plan ?? null,
      target_duration_days: input.target_duration_days ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create practice session: no data returned.");
  }

  return { data: data as PracticeSession };
}

// ──────────────────────────────────────────────
// getPracticeSessionById
// ──────────────────────────────────────────────

/**
 * Get a single practice session by its `id`, scoped to the given `userId`.
 *
 * Returns `null` if the session is not found or not accessible.
 */
export async function getPracticeSessionById(id: string, userId: string) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("practice_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return { data: data as PracticeSession | null };
}

// ──────────────────────────────────────────────
// listUserPracticeSessions
// ──────────────────────────────────────────────

/**
 * List practice sessions for a user with optional status filtering.
 *
 * Results are ordered by `created_at` descending (newest first).
 */
export async function listUserPracticeSessions(
  filters: ListUserSessionsFilters,
) {
  const db = await createDatabaseClient();

  let query = db
    .from("practice_sessions")
    .select("*")
    .eq("user_id", filters.userId);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  query = query.order("created_at", { ascending: false });

  if (filters.limit && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as PracticeSession[] };
}

// ──────────────────────────────────────────────
// updatePracticeSession
// ──────────────────────────────────────────────

/**
 * Update a practice session's mutable fields.
 *
 * Only the record matching `sessionId` AND `userId` (for ownership scoping) is
 * updated. Returns the updated record.
 */
export async function updatePracticeSession(input: UpdatePracticeSessionInput) {
  const db = await createDatabaseClient();

  // Verify the record exists and is accessible
  const { data: existing, error: findError } = await db
    .from("practice_sessions")
    .select("id")
    .eq("id", input.sessionId)
    .eq("user_id", input.userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Practice session with id "${input.sessionId}" not found or not accessible.`,
    );
  }

  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.virtual_balance !== undefined)
    payload.virtual_balance = input.virtual_balance;
  if (input.lesson_plan !== undefined) payload.lesson_plan = input.lesson_plan;
  if (input.target_duration_days !== undefined)
    payload.target_duration_days = input.target_duration_days;

  const { data, error } = await db
    .from("practice_sessions")
    .update(payload)
    .eq("id", input.sessionId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Practice session with id "${input.sessionId}" not found or could not be updated.`,
    );
  }

  return { data: data as PracticeSession };
}

// ──────────────────────────────────────────────
// updatePracticeSessionStatus
// ──────────────────────────────────────────────

/**
 * Update the status of a practice session.
 *
 * Special handling:
 * - When transitioning to `"active"`: sets `started_at` if not already set.
 * - When transitioning to `"paused"`: sets `paused_at` to the current timestamp.
 * - When transitioning to `"completed"`: sets `completed_at` to the current timestamp.
 * - When transitioning to `"abandoned"`: no special timestamp handling.
 */
export async function updatePracticeSessionStatus(params: {
  sessionId: string;
  userId: string;
  status: PracticeSessionStatus;
}) {
  const db = await createDatabaseClient();

  // Fetch current record to inspect existing state
  const { data: existing, error: findError } = await db
    .from("practice_sessions")
    .select("id, status, started_at")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Practice session with id "${params.sessionId}" not found or not accessible.`,
    );
  }

  const payload: Record<string, unknown> = {
    status: params.status,
  };

  // Set timestamps based on the target status
  const now = new Date().toISOString();

  if (params.status === "active" && !existing.started_at) {
    payload.started_at = now;
  }

  if (params.status === "paused") {
    payload.paused_at = now;
  }

  if (params.status === "completed") {
    payload.completed_at = now;
  }

  const { data, error } = await db
    .from("practice_sessions")
    .update(payload)
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Practice session with id "${params.sessionId}" not found or could not be updated.`,
    );
  }

  return { data: data as PracticeSession };
}

// ──────────────────────────────────────────────
// deletePracticeSession
// ──────────────────────────────────────────────

/**
 * Delete a practice session by its `id`, scoped to the given `userId`.
 *
 * Throws if the record is not found or not accessible.
 * Associated virtual trades and practice rules are cascade-deleted.
 */
export async function deletePracticeSession(
  id: string,
  userId: string,
): Promise<void> {
  const db = await createDatabaseClient();

  // First verify the record exists and is accessible
  const { data: existing, error: findError } = await db
    .from("practice_sessions")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Practice session with id "${id}" not found or not accessible.`,
    );
  }

  const { error } = await db
    .from("practice_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
