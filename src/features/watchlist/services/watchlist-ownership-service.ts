import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";

/**
 * Asserts that a watchlist item belongs to the given user.
 * Throws an AppError with NOT_FOUND if the item does not exist or
 * belongs to a different user.
 */
export async function assertWatchlistItemOwnership(params: {
  userId: string;
  itemId: string;
}): Promise<void> {
  const supabase = await createServerClient();

  const { data: item, error } = await supabase
    .from("watchlist_items")
    .select("id, user_id")
    .eq("id", params.itemId)
    .single();

  if (error || !item) {
    throw new AppError(
      "NOT_FOUND",
      "Watchlist itemが見つかりませんでした。",
      404,
      error,
    );
  }

  if (item.user_id !== params.userId) {
    throw new AppError(
      "NOT_FOUND",
      "Watchlist itemが見つかりませんでした。",
      404,
    );
  }
}
