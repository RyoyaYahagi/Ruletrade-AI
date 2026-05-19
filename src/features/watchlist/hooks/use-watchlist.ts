"use client";

import { useEffect, useState } from "react";

type DbWatchlist = {
  id: string;
  name: string;
  base_currency: string;
  description: string | null;
};

type WatchlistResponse = {
  watchlist: DbWatchlist;
};

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<DbWatchlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/watchlist");
        const json = await response.json();

        if (!response.ok || !json.ok) {
          setError(
            json.error?.message ?? "Watchlistの取得に失敗しました。",
          );
          return;
        }

        const data = json.data as WatchlistResponse;
        if (!cancelled) {
          setWatchlist(data.watchlist);
        }
      } catch {
        if (!cancelled) {
          setError("通信に失敗しました。");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { watchlist, isLoading, error };
}
