import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

/**
 * release_checklists / release_checklist_items テーブル CRUD
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type ReleaseChecklist = {
  id: string;
  release_plan_id: string;
  checklist_key: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ReleaseChecklistItem = {
  id: string;
  checklist_id: string;
  item_key: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  checked_by: string | null;
  checked_at: string | null;
  evidence_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReleaseChecklistWithItems = ReleaseChecklist & {
  items: ReleaseChecklistItem[];
};

export type CreateReleaseChecklistInput = {
  release_plan_id: string;
  checklist_key: string;
  title: string;
  status?: string;
  items?: {
    item_key: string;
    title: string;
    description?: string;
    category: string;
    status?: string;
    evidence_url?: string;
    notes?: string;
  }[];
};

export type CreateReleaseChecklistItemInput = {
  checklist_id: string;
  item_key: string;
  title: string;
  description?: string;
  category: string;
  status?: string;
  checked_by?: string | null;
  checked_at?: string | null;
  evidence_url?: string;
  notes?: string;
};

export type UpdateChecklistItemStatusInput = {
  status: string;
  checked_by?: string | null;
  checked_at?: string | null;
  evidence_url?: string | null;
  notes?: string | null;
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Fetch all items for a given checklist ID.
 */
async function fetchItemsByChecklistId(
  checklistId: string,
): Promise<ReleaseChecklistItem[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("release_checklist_items")
    .select("*")
    .eq("checklist_id", checklistId)
    .order("item_key", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ReleaseChecklistItem[];
}

// ──────────────────────────────────────────────
// createReleaseChecklist
// ──────────────────────────────────────────────

/**
 * Create a new release checklist and optionally its items.
 *
 * Creates the parent `release_checklists` row first, then bulk-inserts any
 * items provided in `input.items`. Returns the checklist with its items nested.
 */
export async function createReleaseChecklist(
  input: CreateReleaseChecklistInput,
) {
  const supabase = await createServerClient();

  // 1. Create the checklist
  const { data: checklist, error: checkErr } = await supabase
    .from("release_checklists")
    .insert({
      release_plan_id: input.release_plan_id,
      checklist_key: input.checklist_key,
      title: input.title,
      status: input.status ?? "open",
    })
    .select("*")
    .single();

  if (checkErr) throw checkErr;
  if (!checklist) {
    throw new Error("Failed to create release checklist: no data returned.");
  }

  // 2. Create items if provided
  let items: ReleaseChecklistItem[] = [];

  if (input.items && input.items.length > 0) {
    const itemRows = input.items.map((item) => ({
      checklist_id: checklist.id,
      item_key: item.item_key,
      title: item.title,
      description: item.description ?? null,
      category: item.category,
      status: item.status ?? "unchecked",
      checked_by: null,
      checked_at: null,
      evidence_url: item.evidence_url ?? null,
      notes: item.notes ?? null,
    }));

    const { data: insertedItems, error: itemErr } = await supabase
      .from("release_checklist_items")
      .insert(itemRows)
      .select("*");

    if (itemErr) throw itemErr;
    items = (insertedItems ?? []) as ReleaseChecklistItem[];
  }

  return {
    data: {
      ...(checklist as ReleaseChecklist),
      items,
    } as ReleaseChecklistWithItems,
  };
}

// ──────────────────────────────────────────────
// listChecklistsByReleasePlan
// ──────────────────────────────────────────────

/**
 * List all release checklists for a given release plan, each with its items
 * nested.
 *
 * Results are ordered by `checklist_key` ascending.
 */
export async function listChecklistsByReleasePlan(releasePlanId: string) {
  const supabase = await createServerClient();

  // 1. Fetch all checklists for the release plan
  const { data: checklists, error: listErr } = await supabase
    .from("release_checklists")
    .select("*")
    .eq("release_plan_id", releasePlanId)
    .order("checklist_key", { ascending: true });

  if (listErr) throw listErr;

  const result = (checklists ?? []) as ReleaseChecklist[];

  // 2. Fetch items for each checklist in parallel
  const withItems: ReleaseChecklistWithItems[] = await Promise.all(
    result.map(async (checklist) => {
      const items = await fetchItemsByChecklistId(checklist.id);
      return { ...checklist, items };
    }),
  );

  return { data: withItems };
}

// ──────────────────────────────────────────────
// updateChecklistItemStatus
// ──────────────────────────────────────────────

/**
 * Update a single checklist item's status and related fields.
 *
 * When the status changes to a terminal value ("passed", "failed", "blocked"),
 * `checked_at` is automatically set to the current ISO timestamp unless an
 * explicit value is provided in `input.checked_at`. If `checked_by` is
 * provided, it is persisted on the record.
 *
 * Lookup is performed by `(checklist_id, item_key)` composite.
 */
export async function updateChecklistItemStatus(
  checklistId: string,
  itemKey: string,
  input: UpdateChecklistItemStatusInput,
) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {
    status: input.status,
  };

  // Persist checked_by if provided
  if (input.checked_by !== undefined) {
    payload.checked_by = input.checked_by;
  }

  // Auto-set checked_at when transitioning to a checked status, unless an
  // explicit value is provided
  if (input.checked_at !== undefined) {
    payload.checked_at = input.checked_at;
  } else if (
    input.status === "passed" ||
    input.status === "failed" ||
    input.status === "blocked"
  ) {
    payload.checked_at = new Date().toISOString();
  }

  // Persist evidence_url if provided
  if (input.evidence_url !== undefined) {
    payload.evidence_url = input.evidence_url;
  }

  // Persist notes if provided
  if (input.notes !== undefined) {
    payload.notes = input.notes;
  }

  const { data, error } = await supabase
    .from("release_checklist_items")
    .update(payload)
    .eq("checklist_id", checklistId)
    .eq("item_key", itemKey)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Checklist item with checklist_id "${checklistId}" and item_key "${itemKey}" not found or could not be updated.`,
    );
  }

  return { data: data as ReleaseChecklistItem };
}
