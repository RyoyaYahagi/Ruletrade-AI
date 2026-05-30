import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

/**
 * release_plan_items テーブル CRUD
 */

export type ReleasePlanItem = {
  id: string;
  release_plan_id: string;
  item_type: string;
  title: string;
  description: string | null;
  github_url: string | null;
  local_issue_key: string | null;
  status: string;
  is_blocker: boolean | null;
  risk_level: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateReleasePlanItemInput = {
  release_plan_id: string;
  item_type: string;
  title: string;
  description?: string;
  github_url?: string;
  local_issue_key?: string;
  status?: string;
  is_blocker?: boolean;
  risk_level?: string;
};

export type UpdateReleasePlanItemStatusInput = {
  status: string;
};

/**
 * Create a new release plan item.
 */
export async function createReleasePlanItem(input: CreateReleasePlanItemInput) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("release_plan_items")
    .insert({
      release_plan_id: input.release_plan_id,
      item_type: input.item_type,
      title: input.title,
      description: input.description ?? null,
      github_url: input.github_url ?? null,
      local_issue_key: input.local_issue_key ?? null,
      status: input.status ?? "open",
      is_blocker: input.is_blocker ?? null,
      risk_level: input.risk_level ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create release plan item: no data returned.");
  }

  return { data: data as ReleasePlanItem };
}

/**
 * List all release plan items for a given release plan.
 *
 * Results are ordered by created_at ascending.
 */
export async function listReleasePlanItems(releasePlanId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("release_plan_items")
    .select("*")
    .eq("release_plan_id", releasePlanId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return { data: (data ?? []) as ReleasePlanItem[] };
}

/**
 * Update a release plan item's status.
 *
 * Lookup is performed by the item's `id`.
 */
export async function updateReleasePlanItemStatus(
  itemId: string,
  status: string,
) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {
    status,
  };

  const { data, error } = await supabase
    .from("release_plan_items")
    .update(payload)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Release plan item with id "${itemId}" not found or could not be updated.`,
    );
  }

  return { data: data as ReleasePlanItem };
}
