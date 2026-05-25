"use client";

import { useCallback, useEffect, useState } from "react";

export type PortfolioData = {
  id: string;
  name: string;
  base_currency: string;
  cash_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/portfolio");
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(
          json.error?.message ?? "ポートフォリオの取得に失敗しました。",
        );
        return;
      }

      setPortfolio(json.data.portfolio);
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

  return {
    portfolio,
    isLoading,
    errorMessage,
    reload,
  };
}
