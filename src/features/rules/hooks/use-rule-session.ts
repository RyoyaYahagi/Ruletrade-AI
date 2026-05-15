"use client";

import { useCallback, useEffect, useState } from "react";

export function useRuleSession(sessionId: string) {
  const [data, setData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/rule-sessions/${sessionId}`);
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "データの取得に失敗しました。");
        return;
      }

      setData(json.data);
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function reload() {
    await load();
  }

  return {
    data,
    isLoading,
    errorMessage,
    reload,
  };
}
