"use client";

import { useState } from "react";
import { AiErrorPanel } from "@/features/rules/components/ai-error-panel";

export function ReviewActionBar({
  sessionId,
  onReviewed,
}: {
  sessionId: string;
  onReviewed: () => void;
}) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<{
    code?: string;
    message?: string;
    requestId?: string;
  } | null>(null);

  async function handleReview() {
    setIsReviewing(true);
    setError(null);

    try {
      const response = await fetch(`/api/rule-sessions/${encodeURIComponent(sessionId)}/review`, {
        method: "POST",
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        setError(json.error);
        return;
      }

      onReviewed();
    } catch {
      setError({
        code: "NETWORK_ERROR",
        message: "通信に失敗しました。",
      });
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <section className="rounded-lg border p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">AIレビュー</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ルールの抜け漏れを確認し、必要な追加質問を生成します。
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleReview()}
          disabled={isReviewing}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isReviewing ? "レビュー中..." : "AIレビューを実行"}
        </button>
      </div>

      {error ? (
        <div className="mt-4">
          <AiErrorPanel error={error} />
        </div>
      ) : null}
    </section>
  );
}
