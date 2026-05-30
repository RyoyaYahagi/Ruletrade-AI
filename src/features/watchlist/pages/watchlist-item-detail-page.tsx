"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WatchlistItemDetail } from "@/features/watchlist/components/watchlist-item-detail";
import { CreateRuleSessionFromWatchlistButton } from "@/features/watchlist/components/create-rule-session-from-watchlist-button";
import type { DbWatchlistItem } from "@/features/watchlist/types/watchlist-item";

export function WatchlistItemDetailPage({ itemId }: { itemId: string }) {
  const [item, setItem] = useState<DbWatchlistItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/watchlist/items/${itemId}`);
        const json = await response.json();

        if (!response.ok || !json.ok) {
          setErrorMessage(
            json.error?.message ?? "アイテムの取得に失敗しました。",
          );
          return;
        }

        setItem(json.data.item);
      } catch {
        setErrorMessage("通信に失敗しました。");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [itemId]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <section className="rounded-lg border p-6 text-sm text-muted-foreground">
          読み込み中...
        </section>
      </main>
    );
  }

  if (errorMessage || !item) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <section className="rounded-lg border p-6">
          <p className="text-sm text-red-700">
            {errorMessage ?? "アイテムが見つかりませんでした。"}
          </p>
          <Link
            href="/watchlist"
            className="mt-4 inline-block text-sm text-blue-600 underline"
          >
            Watchlistに戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <Link href="/watchlist" className="text-sm text-blue-600 underline">
          &larr; Watchlistに戻る
        </Link>
      </div>

      <WatchlistItemDetail item={item} />

      <div className="mt-6">
        <CreateRuleSessionFromWatchlistButton itemId={itemId} />
      </div>
    </main>
  );
}
