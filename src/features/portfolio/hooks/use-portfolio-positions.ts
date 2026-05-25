"use client";

import { useCallback, useEffect, useState } from "react";

export type PortfolioPositionData = {
  id: string;
  ticker: string;
  company_name: string | null;
  market: string | null;
  currency: string;
  asset_type: string;
  sector: string | null;
  theme: string | null;
  quantity: number | null;
  average_cost: number | null;
  current_price: number | null;
  market_value: number;
  target_weight_percent: number | null;
  rule_session_id: string | null;
  position_status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export function usePortfolioPositions() {
  const [positions, setPositions] = useState<PortfolioPositionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/portfolio/positions");
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(
          json.error?.message ?? "保有銘柄の取得に失敗しました。",
        );
        return;
      }

      setPositions(json.data.positions ?? []);
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function reload() {
    await load();
  }

  async function addPosition(body: Record<string, unknown>) {
    try {
      const response = await fetch("/api/portfolio/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        return {
          success: false,
          error: json.error?.message ?? "保有銘柄の追加に失敗しました。",
        };
      }

      await load();
      return { success: true, error: null };
    } catch {
      return { success: false, error: "通信に失敗しました。" };
    }
  }

  return {
    positions,
    isLoading,
    errorMessage,
    reload,
    addPosition,
  };
}
