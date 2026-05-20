import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

/**
 * release_plans テーブル CRUD
 */

export type ReleasePlan = {
  id: string;
  release_key: string;
  version: string;
  title: string;
  summary: string | null;
  phase: string;
  status: string;
  milestone_key: string | null;
  release_type: string;
  planned_release_at: string | null;
  released_at: string | null;
  rolled_back_at: string | null;
  git_tag: string | null;
  git_commit_sha: string | null;
  github_release_url: string | null;
  vercel_deployment_url: string | null;
  includes_db_migration: boolean | null;
  includes_rls_change: boolean | null;
  includes_env_change: boolean | null;
  includes_feature_flag_change: boolean | null;
  includes_ai_prompt_change: boolean | null;
  includes_billing_change: boolean | null;
  includes_privacy_change: boolean | null;
  rollback_strategy: string | null;
  release_notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CreateReleasePlanInput = {
  release_key: string;
  version: string;
  title: string;
  summary?: string;
  phase?: string;
  status?: string;
  milestone_key?: string;
  release_type?: string;
  planned_release_at?: string;
  released_at?: string | null;
  rolled_back_at?: string | null;
  git_tag?: string;
  git_commit_sha?: string;
  github_release_url?: string;
  vercel_deployment_url?: string;
  includes_db_migration?: boolean;
  includes_rls_change?: boolean;
  includes_env_change?: boolean;
  includes_feature_flag_change?: boolean;
  includes_ai_prompt_change?: boolean;
  includes_billing_change?: boolean;
  includes_privacy_change?: boolean;
  rollback_strategy?: string;
  release_notes?: string;
  created_by?: string;
  approved_by?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateReleasePlanStatusInput = {
  status: string;
  approved_by?: string;
  released_at?: string | null;
  rolled_back_at?: string | null;
};

export type ListReleasePlansFilters = {
  status?: string;
};

/**
 * Create a new release plan.
 */
export async function createReleasePlan(input: CreateReleasePlanInput) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("release_plans")
    .insert({
      release_key: input.release_key,
      version: input.version,
      title: input.title,
      summary: input.summary ?? null,
      phase: input.phase ?? "planning",
      status: input.status ?? "draft",
      milestone_key: input.milestone_key ?? null,
      release_type: input.release_type ?? "standard",
      planned_release_at: input.planned_release_at ?? null,
      released_at: input.released_at ?? null,
      rolled_back_at: input.rolled_back_at ?? null,
      git_tag: input.git_tag ?? null,
      git_commit_sha: input.git_commit_sha ?? null,
      github_release_url: input.github_release_url ?? null,
      vercel_deployment_url: input.vercel_deployment_url ?? null,
      includes_db_migration: input.includes_db_migration ?? null,
      includes_rls_change: input.includes_rls_change ?? null,
      includes_env_change: input.includes_env_change ?? null,
      includes_feature_flag_change: input.includes_feature_flag_change ?? null,
      includes_ai_prompt_change: input.includes_ai_prompt_change ?? null,
      includes_billing_change: input.includes_billing_change ?? null,
      includes_privacy_change: input.includes_privacy_change ?? null,
      rollback_strategy: input.rollback_strategy ?? null,
      release_notes: input.release_notes ?? null,
      created_by: input.created_by ?? null,
      approved_by: input.approved_by ?? null,
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create release plan: no data returned.");
  }

  return { data: data as ReleasePlan };
}

/**
 * List release plans with optional status filtering.
 *
 * Supported filters:
 *   - status (string, exact match)
 *
 * Results are ordered by created_at descending.
 */
export async function listReleasePlans(filters?: ListReleasePlansFilters) {
  const supabase = await createServerClient();

  let query = supabase.from("release_plans").select("*");

  // Apply filters
  if (filters) {
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
  }

  // Order: created_at DESC
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as ReleasePlan[] };
}

/**
 * Get a single release plan by its unique `release_key`.
 */
export async function getReleasePlanByKey(releaseKey: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("release_plans")
    .select("*")
    .eq("release_key", releaseKey)
    .maybeSingle();

  if (error) throw error;

  return { data: data as ReleasePlan | null };
}

/**
 * Update a release plan's status (and optionally timestamps).
 *
 * When transitioning to specific statuses, the service automatically sets
 * timestamps:
 *   - "released"    → sets `released_at` to the current ISO timestamp
 *   - "rolled_back" → sets `rolled_back_at` to the current ISO timestamp
 *
 * If `approved_by` is provided, it is persisted on the record.
 */
export async function updateReleasePlanStatus(
  releaseKey: string,
  input: UpdateReleasePlanStatusInput,
) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {
    status: input.status,
  };

  // Auto-set released_at when transitioning to "released" status, unless an
  // explicit value is provided
  if (input.released_at !== undefined) {
    payload.released_at = input.released_at;
  } else if (input.status === "released") {
    payload.released_at = new Date().toISOString();
  }

  // Auto-set rolled_back_at when transitioning to "rolled_back" status, unless
  // an explicit value is provided
  if (input.rolled_back_at !== undefined) {
    payload.rolled_back_at = input.rolled_back_at;
  } else if (input.status === "rolled_back") {
    payload.rolled_back_at = new Date().toISOString();
  }

  // Persist approved_by if provided
  if (input.approved_by !== undefined) {
    payload.approved_by = input.approved_by;
  }

  const { data, error } = await supabase
    .from("release_plans")
    .update(payload)
    .eq("release_key", releaseKey)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Release plan with release_key "${releaseKey}" not found or could not be updated.`,
    );
  }

  return { data: data as ReleasePlan };
}
