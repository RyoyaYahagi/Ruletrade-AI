"use client";

import { useState } from "react";

type CreateRuleSessionResponse = {
  sessionId: string;
};

export function useCreateRuleSessionFromWatchlist() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRuleSession(itemId: string) {
    setIsCreating(true);
    setError(null);
    setSessionId(null);

    try {
      const response = await fetch(
        `/api/watchlist/items/${itemId}/create-rule-session`,
        { method: "POST" },
      );
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setError(json.error?.message ?? "Rule Sessionの作成に失敗しました。");
        return;
      }

      const data = json.data as CreateRuleSessionResponse;
      setSessionId(data.sessionId);
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setIsCreating(false);
    }
  }

  return { sessionId, isCreating, error, createRuleSession };
}
