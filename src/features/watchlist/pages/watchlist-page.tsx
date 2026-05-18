"use client";

import { useState } from "react";
import Link from "next/link";
import { WatchlistSummaryCard } from "@/features/watchlist/components/watchlist-summary-card";
import { WatchlistItemTable } from "@/features/watchlist/components/watchlist-item-table";
import { WatchlistReviewPanel } from "@/features/watchlist/components/watchlist-review-panel";

export function WatchlistPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Watchlist</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            気になる銘柄を保存し、買う前に決めるべきルールを整理します。
          </p>
        </div>

        <Link
          href="/watchlist/items/new"
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          銘柄を追加
        </Link>
      </div>

      <div className="mt-6 space-y-6">
        <WatchlistSummaryCard key={`summary-${refreshKey}`} />
        <WatchlistItemTable key={`items-${refreshKey}`} />
        <WatchlistReviewPanel
          key={`review-${refreshKey}`}
          onReviewComplete={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </main>
  );
}
