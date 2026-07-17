"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateRuleSessionFromPositionButton({
  positionId,
}: {
  positionId: string;
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate() {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/portfolio/positions/${positionId}/create-rule-session`,
        { method: "POST" },
      );
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "ルールの作成に失敗しました。");
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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={isCreating}
        className="rounded-md border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
        data-testid="portfolio-position-create-rule-button"
      >
        {isCreating ? "作成中..." : "ルールを作る"}
      </button>
      {errorMessage ? (
        <p
          className="max-w-48 rounded-md bg-red-50 p-2 text-left text-xs text-red-700"
          data-testid="portfolio-position-create-rule-error"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
