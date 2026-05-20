"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateRuleSessionFromWatchlistButton({
  itemId,
}: {
  itemId: string;
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate() {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/watchlist/items/${itemId}/create-rule-session`,
        { method: "POST" },
      );
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(
          json.error?.message ?? "Rule Sessionの作成に失敗しました。",
        );
        return;
      }

      const { sessionId } = json.data;
      router.push(`/rules/${sessionId}`);
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={isCreating}
        className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isCreating ? "作成中..." : "Rule Sessionを作成"}
      </button>
      {errorMessage ? (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
