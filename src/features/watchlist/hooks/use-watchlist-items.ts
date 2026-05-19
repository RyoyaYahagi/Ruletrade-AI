"use client";

import { useCallback, useEffect, useState } from "react";
import type { DbWatchlistItem } from "@/features/watchlist/types/watchlist-item";

type ItemsResponse = {
  items: DbWatchlistItem[];
};

export function useWatchlistItems() {
  const [items, setItems] = useState<DbWatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/watchlist/items");
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setError(
          json.error?.message ?? "Watchlist itemsの取得に失敗しました。",
        );
        return;
      }

      const data = json.data as ItemsResponse;
      setItems(data.items);
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/watchlist/items");
        const json = await response.json();

        if (cancelled) return;

        if (!response.ok || !json.ok) {
          setError(
            json.error?.message ?? "Watchlist itemsの取得に失敗しました。",
          );
          return;
        }

        const data = json.data as ItemsResponse;
        setItems(data.items);
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

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/watchlist/items");
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setError(
          json.error?.message ?? "Watchlist itemsの取得に失敗しました。",
        );
        return;
      }

      const data = json.data as ItemsResponse;
      setItems(data.items);
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { items, isLoading, error, refetch };
}
