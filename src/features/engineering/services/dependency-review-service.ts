import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

/**
 * dependency_review_items テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type DependencyReviewItem = {
  id: string;
  dependency_name: string;
  package_manager: string;
  requested_version: string;
  resolved_version: string | null;
  review_status: string;
  usage_reason: string | null;
  alternatives_considered: string | null;
  license_name: string | null;
  source_url: string | null;
  security_score: number | null;
  known_vulnerability_count: number | null;
  is_runtime_dependency: boolean;
  is_client_bundle_dependency: boolean;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CreateDependencyReviewItemInput = {
  dependency_name: string;
  package_manager: string;
  requested_version: string;
  resolved_version?: string | null;
  review_status?: string;
  usage_reason?: string | null;
  alternatives_considered?: string | null;
  license_name?: string | null;
  source_url?: string | null;
  security_score?: number | null;
  known_vulnerability_count?: number | null;
  is_runtime_dependency?: boolean;
  is_client_bundle_dependency?: boolean;
  requested_by?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ListDependencyReviewItemsFilters = {
  reviewStatus?: string;
  packageManager?: string;
  limit?: number;
};

export type UpdateDependencyReviewStatusInput = {
  itemId: string;
  reviewStatus: string;
  reviewedBy: string;
};

// ──────────────────────────────────────────────
// createDependencyReviewItem
// ──────────────────────────────────────────────

/**
 * Create or update a dependency review item (upsert).
 *
 * Uses `dependency_name` + `package_manager` as the unique constraint to
 * prevent duplicates. If a matching row already exists, it is updated
 * (including the `requested_version` and any other provided fields).
 * If no match exists, a new row is inserted.
 *
 * Returns the created/updated dependency review item record.
 */
export async function createDependencyReviewItem(
  input: CreateDependencyReviewItemInput,
) {
  const supabase = await createServerClient();

  // Attempt to find an existing item with the same unique key
  const { data: existing, error: findError } = await supabase
    .from("dependency_review_items")
    .select("id")
    .eq("dependency_name", input.dependency_name)
    .eq("package_manager", input.package_manager)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    // ── Update existing row ──
    const updatePayload: Record<string, unknown> = {
      requested_version: input.requested_version,
    };

    if (input.resolved_version !== undefined) {
      updatePayload.resolved_version = input.resolved_version;
    }
    if (input.review_status !== undefined) {
      updatePayload.review_status = input.review_status;
    }
    if (input.usage_reason !== undefined) {
      updatePayload.usage_reason = input.usage_reason;
    }
    if (input.alternatives_considered !== undefined) {
      updatePayload.alternatives_considered = input.alternatives_considered;
    }
    if (input.license_name !== undefined) {
      updatePayload.license_name = input.license_name;
    }
    if (input.source_url !== undefined) {
      updatePayload.source_url = input.source_url;
    }
    if (input.security_score !== undefined) {
      updatePayload.security_score = input.security_score;
    }
    if (input.known_vulnerability_count !== undefined) {
      updatePayload.known_vulnerability_count = input.known_vulnerability_count;
    }
    if (input.is_runtime_dependency !== undefined) {
      updatePayload.is_runtime_dependency = input.is_runtime_dependency;
    }
    if (input.is_client_bundle_dependency !== undefined) {
      updatePayload.is_client_bundle_dependency =
        input.is_client_bundle_dependency;
    }
    if (input.metadata !== undefined) {
      updatePayload.metadata = input.metadata;
    }

    const { data, error } = await supabase
      .from("dependency_review_items")
      .update(updatePayload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error(
        `Dependency review item with id "${existing.id}" could not be updated.`,
      );
    }

    return { data: data as DependencyReviewItem };
  }

  // ── Insert new row ──
  const { data, error } = await supabase
    .from("dependency_review_items")
    .insert({
      dependency_name: input.dependency_name,
      package_manager: input.package_manager,
      requested_version: input.requested_version,
      resolved_version: input.resolved_version ?? null,
      review_status: input.review_status ?? "pending",
      usage_reason: input.usage_reason ?? null,
      alternatives_considered: input.alternatives_considered ?? null,
      license_name: input.license_name ?? null,
      source_url: input.source_url ?? null,
      security_score: input.security_score ?? null,
      known_vulnerability_count: input.known_vulnerability_count ?? null,
      is_runtime_dependency: input.is_runtime_dependency ?? true,
      is_client_bundle_dependency: input.is_client_bundle_dependency ?? false,
      requested_by: input.requested_by ?? null,
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "Failed to create dependency review item: no data returned.",
    );
  }

  return { data: data as DependencyReviewItem };
}

// ──────────────────────────────────────────────
// listDependencyReviewItems
// ──────────────────────────────────────────────

/**
 * List dependency review items with optional reviewStatus/packageManager filtering.
 *
 * Supported filters:
 *   - reviewStatus    (string, exact match on `review_status`)
 *   - packageManager  (string, exact match on `package_manager`)
 *   - limit           (number, max results to return)
 *
 * Results are ordered by `created_at` descending (newest first).
 */
export async function listDependencyReviewItems(
  filters?: ListDependencyReviewItemsFilters,
) {
  const supabase = await createServerClient();

  let query = supabase.from("dependency_review_items").select("*");

  // Apply filters
  if (filters) {
    if (filters.reviewStatus) {
      query = query.eq("review_status", filters.reviewStatus);
    }
    if (filters.packageManager) {
      query = query.eq("package_manager", filters.packageManager);
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

  return { data: (data ?? []) as DependencyReviewItem[] };
}

// ──────────────────────────────────────────────
// updateDependencyReviewStatus
// ──────────────────────────────────────────────

/**
 * Update the review status of a dependency review item.
 *
 * Looks up the item by its `id` and updates:
 *   - `review_status` → the provided review status
 *   - `reviewed_by` → the reviewer
 *   - `reviewed_at` → current ISO timestamp
 *
 * Throws an error if the record is not found.
 *
 * Returns the updated dependency review item record.
 */
export async function updateDependencyReviewStatus(
  input: UpdateDependencyReviewStatusInput,
) {
  const supabase = await createServerClient();

  // Fetch current item to ensure it exists
  const { data: existing, error: findError } = await supabase
    .from("dependency_review_items")
    .select("id, review_status")
    .eq("id", input.itemId)
    .single();

  if (findError || !existing) {
    throw new Error(
      `Dependency review item with id "${input.itemId}" not found.`,
    );
  }

  const payload: Record<string, unknown> = {
    review_status: input.reviewStatus,
    reviewed_by: input.reviewedBy,
    reviewed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("dependency_review_items")
    .update(payload)
    .eq("id", input.itemId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Dependency review item with id "${input.itemId}" could not be updated.`,
    );
  }

  return { data: data as DependencyReviewItem };
}
