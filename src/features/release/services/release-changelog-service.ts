import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

/**
 * release_changelog_entries テーブル CRUD
 */

// ──────────────────────────────────────────────
// Forbidden terms for public changelog safety
// ──────────────────────────────────────────────

const FORBIDDEN_PUBLIC_CHANGELOG_TERMS = [
  "Service Role Key",
  "ownership bypass",
  "脆弱性の詳細",
  "攻撃手順",
  "secret",
  "token",
  "API key",
];

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type ReleaseChangelogEntry = {
  id: string;
  release_plan_id: string;
  category: string;
  audience: string;
  title: string;
  body: string;
  is_breaking_change: boolean;
  is_public_safe: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateReleaseChangelogEntryInput = {
  releasePlanId: string;
  category: string;
  audience: string;
  title: string;
  body: string;
  isBreakingChange?: boolean;
  isPublicSafe?: boolean;
  sortOrder?: number;
  createdBy?: string | null;
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Validate that the given input does not contain any terms that are forbidden
 * from appearing in a public changelog. Throws an Error if any forbidden term
 * is found (case-insensitive matching).
 */
export function validatePublicChangelogSafety(input: string): void {
  const lowerInput = input.toLowerCase();

  for (const term of FORBIDDEN_PUBLIC_CHANGELOG_TERMS) {
    if (lowerInput.includes(term.toLowerCase())) {
      throw new Error(
        `Public changelog validation failed: the input contains a forbidden term "${term}". Remove it before publishing.`,
      );
    }
  }
}

// ──────────────────────────────────────────────
// createReleaseChangelogEntry
// ──────────────────────────────────────────────

/**
 * Create a new release changelog entry.
 *
 * If the audience is "public" or "both", the `body` and `title` are validated
 * against FORBIDDEN_PUBLIC_CHANGELOG_TERMS before insertion.
 */
export async function createReleaseChangelogEntry(
  input: CreateReleaseChangelogEntryInput,
) {
  // Validate public safety when the entry is visible to the public
  if (input.audience === "public" || input.audience === "both") {
    validatePublicChangelogSafety(input.title);
    validatePublicChangelogSafety(input.body);
  }

  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("release_changelog_entries")
    .insert({
      release_plan_id: input.releasePlanId,
      category: input.category,
      audience: input.audience ?? "internal",
      title: input.title,
      body: input.body,
      is_breaking_change: input.isBreakingChange ?? false,
      is_public_safe: input.isPublicSafe ?? false,
      sort_order: input.sortOrder ?? 1000,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "Failed to create release changelog entry: no data returned.",
    );
  }

  return { data: data as ReleaseChangelogEntry };
}

// ──────────────────────────────────────────────
// listChangelogEntriesByReleasePlan
// ──────────────────────────────────────────────

/**
 * List all changelog entries for a given release plan.
 *
 * Results are ordered by `sort_order` ascending, then `created_at` ascending.
 */
export async function listChangelogEntriesByReleasePlan(releasePlanId: string) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("release_changelog_entries")
    .select("*")
    .eq("release_plan_id", releasePlanId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return { data: (data ?? []) as ReleaseChangelogEntry[] };
}
