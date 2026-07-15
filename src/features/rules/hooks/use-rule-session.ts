"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function useRuleSession(sessionId: string) {
  const router = useRouter();
  const [data, setData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/rule-sessions/${sessionId}`);

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        setErrorMessage("データの取得に失敗しました。");
        return;
      }

      const json = await response.json();

      if (!json.ok) {
        setErrorMessage(json.error?.message ?? "データの取得に失敗しました。");
        return;
      }

      setData(json.data);
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [router, sessionId]);

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
