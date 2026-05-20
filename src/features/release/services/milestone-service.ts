import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

/**
 * internal_milestones テーブル CRUD
 */

export type Milestone = {
  id: string;
  milestone_key: string;
  title: string;
  description: string | null;
  phase: string;
  status: string;
  target_date: string | null;
  completed_at: string | null;
  github_milestone_url: string | null;
  github_project_url: string | null;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CreateMilestoneInput = {
  milestone_key: string;
  title: string;
  description?: string;
  phase?: string;
  status?: string;
  target_date?: string;
  completed_at?: string | null;
  github_milestone_url?: string;
  github_project_url?: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateMilestoneStatusInput = {
  status: string;
  completed_at?: string | null;
};

export type ListMilestonesFilters = {
  phase?: string;
  status?: string;
};

/**
 * Create a new milestone.
 */
export async function createMilestone(input: CreateMilestoneInput) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("internal_milestones")
    .insert({
      milestone_key: input.milestone_key,
      title: input.title,
      description: input.description ?? null,
      phase: input.phase ?? "planning",
      status: input.status ?? "draft",
      target_date: input.target_date ?? null,
      completed_at: input.completed_at ?? null,
      github_milestone_url: input.github_milestone_url ?? null,
      github_project_url: input.github_project_url ?? null,
      created_by: input.created_by ?? null,
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create milestone: no data returned.");
  }

  return { data: data as Milestone };
}

/**
 * List milestones with optional phase/status filtering.
 *
 * Supported filters:
 *   - phase   (string, exact match)
 *   - status  (string, exact match)
 *
 * Results are ordered by target_date ascending (nulls last), then by
 * created_at ascending.
 */
export async function listMilestones(filters?: ListMilestonesFilters) {
  const supabase = await createServerClient();

  let query = supabase.from("internal_milestones").select("*");

  // Apply filters
  if (filters) {
    if (filters.phase) {
      query = query.eq("phase", filters.phase);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
  }

  // Order: target_date ASC (nulls last), then created_at ASC
  query = query.order("target_date", { ascending: true, nullsFirst: false });
  query = query.order("created_at", { ascending: true });

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as Milestone[] };
}

/**
 * Get a single milestone by its unique `milestone_key`.
 */
export async function getMilestoneByKey(milestoneKey: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("internal_milestones")
    .select("*")
    .eq("milestone_key", milestoneKey)
    .maybeSingle();

  if (error) throw error;

  return { data: data as Milestone | null };
}

/**
 * Update a milestone's status (and optionally `completed_at`).
 *
 * When `completed_at` is not provided in the input and the new status
 * indicates completion (e.g. "completed"), the service automatically
 * sets `completed_at` to the current ISO timestamp.
 */
export async function updateMilestoneStatus(
  milestoneKey: string,
  input: UpdateMilestoneStatusInput,
) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {
    status: input.status,
  };

  // Auto-set completed_at if status is a completion status and no explicit
  // value was provided
  if (input.completed_at !== undefined) {
    payload.completed_at = input.completed_at;
  } else if (input.status === "completed" || input.status === "archived") {
    payload.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("internal_milestones")
    .update(payload)
    .eq("milestone_key", milestoneKey)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Milestone with milestone_key "${milestoneKey}" not found or could not be updated.`,
    );
  }

  return { data: data as Milestone };
}
