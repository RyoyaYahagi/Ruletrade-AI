import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import type {
  LessonCategory,
  LessonProgress,
  LessonStatus,
} from "@/schemas/education/practice-mode-schema";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type CreateLessonProgressInput = {
  user_id: string;
  lesson_id: string;
  lesson_title: string;
  lesson_category: LessonCategory;
};

export type UpdateLessonProgressInput = {
  progressId: string;
  userId: string;
  status?: LessonStatus;
  completion_percent?: number;
};

export type ListLessonProgressFilters = {
  userId: string;
  lesson_category?: LessonCategory;
  status?: LessonStatus;
  limit?: number;
};

// ──────────────────────────────────────────────
// createLessonProgress
// ──────────────────────────────────────────────

/**
 * Create a new lesson progress record for a user.
 *
 * Inserts a row in `lesson_progress` with the provided details.
 * A unique constraint on (user_id, lesson_id) prevents duplicates;
 * use upsert if you need to create-or-update.
 */
export async function createLessonProgress(input: CreateLessonProgressInput) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("lesson_progress")
    .insert({
      user_id: input.user_id,
      lesson_id: input.lesson_id,
      lesson_title: input.lesson_title,
      lesson_category: input.lesson_category,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create lesson progress: no data returned.");
  }

  return { data: data as LessonProgress };
}

// ──────────────────────────────────────────────
// getLessonProgress
// ──────────────────────────────────────────────

/**
 * Get the lesson progress for a specific user and lesson.
 *
 * Returns `null` if the user has not started this lesson.
 */
export async function getLessonProgress(userId: string, lessonId: string) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) throw error;

  return { data: data as LessonProgress | null };
}

// ──────────────────────────────────────────────
// listUserLessonProgress
// ──────────────────────────────────────────────

/**
 * List lesson progress for a user with optional category and status
 * filtering.
 *
 * Results are ordered by `updated_at` descending (most recently updated
 * first).
 */
export async function listUserLessonProgress(
  filters: ListLessonProgressFilters,
) {
  const db = await createDatabaseClient();

  let query = db
    .from("lesson_progress")
    .select("*")
    .eq("user_id", filters.userId);

  if (filters.lesson_category) {
    query = query.eq("lesson_category", filters.lesson_category);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  query = query.order("updated_at", { ascending: false });

  if (filters.limit && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as LessonProgress[] };
}

// ──────────────────────────────────────────────
// updateLessonProgress
// ──────────────────────────────────────────────

/**
 * Update a lesson progress record's status and/or completion percentage.
 *
 * Special handling:
 * - If `status` is set to `"in_progress"` and `started_at` is null, sets
 *   `started_at` to the current timestamp.
 * - If `status` is set to `"completed"`, sets `completed_at` and
 *   `completion_percent` to 100 (unless overridden).
 *
 * Only the record matching `progressId` AND `userId` is updated.
 */
export async function updateLessonProgress(input: UpdateLessonProgressInput) {
  const db = await createDatabaseClient();

  // Fetch current record to inspect existing state
  const { data: existing, error: findError } = await db
    .from("lesson_progress")
    .select("id, status, started_at")
    .eq("id", input.progressId)
    .eq("user_id", input.userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Lesson progress with id "${input.progressId}" not found or not accessible.`,
    );
  }

  const payload: Record<string, unknown> = {};
  const now = new Date().toISOString();

  if (input.status !== undefined) {
    payload.status = input.status;

    // Auto-set timestamps
    if (input.status === "in_progress" && !existing.started_at) {
      payload.started_at = now;
    }

    if (input.status === "completed") {
      payload.completed_at = now;
      // Default to 100% when marked completed
      payload.completion_percent = 100;
    }
  }

  if (input.completion_percent !== undefined) {
    payload.completion_percent = input.completion_percent;
  }

  const { data, error } = await db
    .from("lesson_progress")
    .update(payload)
    .eq("id", input.progressId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Lesson progress with id "${input.progressId}" not found or could not be updated.`,
    );
  }

  return { data: data as LessonProgress };
}

// ──────────────────────────────────────────────
// upsertLessonProgress
// ──────────────────────────────────────────────

/**
 * Create or update lesson progress for a user and lesson.
 *
 * Since there is a unique constraint on (user_id, lesson_id), this uses
 * SQLite upsert with the conflict target.
 */
export async function upsertLessonProgress(
  input: CreateLessonProgressInput & {
    status?: LessonStatus;
    completion_percent?: number;
  },
) {
  const db = await createDatabaseClient();

  const payload: Record<string, unknown> = {
    user_id: input.user_id,
    lesson_id: input.lesson_id,
    lesson_title: input.lesson_title,
    lesson_category: input.lesson_category,
  };

  if (input.status !== undefined) {
    payload.status = input.status;
  }

  if (input.completion_percent !== undefined) {
    payload.completion_percent = input.completion_percent;
  }

  const { data, error } = await db
    .from("lesson_progress")
    .upsert(payload, {
      onConflict: "user_id, lesson_id",
      ignoreDuplicates: false,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to upsert lesson progress: no data returned.");
  }

  return { data: data as LessonProgress };
}

// ──────────────────────────────────────────────
// markLessonCompleted
// ──────────────────────────────────────────────

/**
 * Convenience function to mark a lesson as completed.
 *
 * Sets status to `"completed"`, completion_percent to 100, and
 * `completed_at` to the current timestamp.
 */
export async function markLessonCompleted(progressId: string, userId: string) {
  const db = await createDatabaseClient();

  // Verify the record exists
  const { data: existing, error: findError } = await db
    .from("lesson_progress")
    .select("id")
    .eq("id", progressId)
    .eq("user_id", userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Lesson progress with id "${progressId}" not found or not accessible.`,
    );
  }

  const now = new Date().toISOString();

  const { data, error } = await db
    .from("lesson_progress")
    .update({
      status: "completed",
      completion_percent: 100,
      completed_at: now,
    })
    .eq("id", progressId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Lesson progress with id "${progressId}" not found or could not be marked completed.`,
    );
  }

  return { data: data as LessonProgress };
}

// ──────────────────────────────────────────────
// deleteLessonProgress
// ──────────────────────────────────────────────

/**
 * Delete a lesson progress record by its `id`, scoped to the given `userId`.
 *
 * Throws if the record is not found or not accessible.
 */
export async function deleteLessonProgress(
  id: string,
  userId: string,
): Promise<void> {
  const db = await createDatabaseClient();

  const { data: existing, error: findError } = await db
    .from("lesson_progress")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Lesson progress with id "${id}" not found or not accessible.`,
    );
  }

  const { error } = await db
    .from("lesson_progress")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
