"use client";

import { WatchlistItemForm } from "@/features/watchlist/components/watchlist-item-form";

export function NewWatchlistItemPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Watchlistに銘柄を追加</h1>
      <div className="mt-6">
        <WatchlistItemForm />
      </div>
    </main>
  );
}
