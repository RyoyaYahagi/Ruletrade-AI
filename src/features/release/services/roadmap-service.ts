import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

/**
 * product_roadmap_items テーブル CRUD
 */

export type RoadmapItem = {
  id: string;
  item_key: string;
  title: string;
  summary: string;
  theme: string;
  initiative: string | null;
  public_status: string;
  internal_status: string;
  priority: string;
  target_milestone_key: string | null;
  target_release_key: string | null;
  is_public: boolean;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateRoadmapItemInput = {
  item_key: string;
  title: string;
  summary: string;
  theme: string;
  initiative?: string;
  public_status?: string;
  internal_status?: string;
  priority?: string;
  target_milestone_key?: string;
  target_release_key?: string;
  is_public?: boolean;
  sort_order?: number;
  created_by?: string;
  updated_by?: string;
};

export type UpdateRoadmapItemInput = {
  title?: string;
  summary?: string;
  theme?: string;
  initiative?: string | null;
  public_status?: string;
  internal_status?: string;
  priority?: string;
  target_milestone_key?: string | null;
  target_release_key?: string | null;
  is_public?: boolean;
  sort_order?: number;
  updated_by?: string;
};

export type ListRoadmapItemsFilters = {
  is_public?: boolean;
  public_status?: string;
  theme?: string;
  priority?: string;
};

export type ListRoadmapItemsSort = {
  column: "theme" | "priority" | "sort_order";
  ascending?: boolean;
};

/**
 * Create a new roadmap item.
 */
export async function createRoadmapItem(input: CreateRoadmapItemInput) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("product_roadmap_items")
    .insert({
      item_key: input.item_key,
      title: input.title,
      summary: input.summary,
      theme: input.theme,
      initiative: input.initiative ?? null,
      public_status: input.public_status ?? "planned",
      internal_status: input.internal_status ?? "backlog",
      priority: input.priority ?? "p2",
      target_milestone_key: input.target_milestone_key ?? null,
      target_release_key: input.target_release_key ?? null,
      is_public: input.is_public ?? false,
      sort_order: input.sort_order ?? 1000,
      created_by: input.created_by ?? null,
      updated_by: input.updated_by ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create roadmap item: no data returned.");
  }

  return { data: data as RoadmapItem };
}

/**
 * List roadmap items with optional filters and sorting.
 *
 * Supported filters:
 *   - is_public       (boolean)
 *   - public_status   (string)
 *   - theme           (string)
 *   - priority        (string)
 *
 * Supported sort columns: "theme", "priority", "sort_order" (default: sort_order ASC).
 */
export async function listRoadmapItems(
  filters?: ListRoadmapItemsFilters,
  sort?: ListRoadmapItemsSort,
) {
  const supabase = await createServerClient();

  let query = supabase.from("product_roadmap_items").select("*");

  // Apply filters
  if (filters) {
    if (filters.is_public !== undefined) {
      query = query.eq("is_public", filters.is_public);
    }
    if (filters.public_status) {
      query = query.eq("public_status", filters.public_status);
    }
    if (filters.theme) {
      query = query.eq("theme", filters.theme);
    }
    if (filters.priority) {
      query = query.eq("priority", filters.priority);
    }
  }

  // Apply sorting
  const sortColumn = sort?.column ?? "sort_order";
  const ascending = sort?.ascending ?? true;
  query = query.order(sortColumn, { ascending });

  const { data, error } = await query;

  if (error) throw error;

  return { data: (data ?? []) as RoadmapItem[] };
}

/**
 * Get a single roadmap item by its unique `item_key`.
 */
export async function getRoadmapItemByKey(itemKey: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("product_roadmap_items")
    .select("*")
    .eq("item_key", itemKey)
    .maybeSingle();

  if (error) throw error;

  return { data: data as RoadmapItem | null };
}

/**
 * Update a roadmap item identified by `item_key`.
 * Only the fields present in `input` will be updated.
 */
export async function updateRoadmapItem(
  itemKey: string,
  input: UpdateRoadmapItemInput,
) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) payload.title = input.title;
  if (input.summary !== undefined) payload.summary = input.summary;
  if (input.theme !== undefined) payload.theme = input.theme;
  if (input.initiative !== undefined) payload.initiative = input.initiative;
  if (input.public_status !== undefined)
    payload.public_status = input.public_status;
  if (input.internal_status !== undefined)
    payload.internal_status = input.internal_status;
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.target_milestone_key !== undefined)
    payload.target_milestone_key = input.target_milestone_key;
  if (input.target_release_key !== undefined)
    payload.target_release_key = input.target_release_key;
  if (input.is_public !== undefined) payload.is_public = input.is_public;
  if (input.sort_order !== undefined) payload.sort_order = input.sort_order;
  if (input.updated_by !== undefined) payload.updated_by = input.updated_by;

  const { data, error } = await supabase
    .from("product_roadmap_items")
    .update(payload)
    .eq("item_key", itemKey)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Roadmap item with item_key "${itemKey}" not found or could not be updated.`,
    );
  }

  return { data: data as RoadmapItem };
}
