"use client";

import Link from "next/link";

export function WatchlistEmptyState() {
  return (
    <section className="rounded-lg border p-6 text-center">
      <h2 className="text-lg font-semibold">Watchlistは空です</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        気になる銘柄を追加しましょう。
      </p>
      <Link
        href="/watchlist/items/new"
        className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm text-white"
      >
        銘柄を追加
      </Link>
    </section>
  );
}
