"use client";

import { useState } from "react";

export function FinalizeRuleButton({
  sessionId,
  completionScore,
  canFinalize,
  onFinalized,
}: {
  sessionId: string;
  completionScore: number | null;
  canFinalize: boolean;
  onFinalized: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFinalize() {
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/rule-sessions/${encodeURIComponent(sessionId)}/finalize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            force: false,
          }),
        },
      );

      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(
          json.error?.message ?? "完成版として保存できませんでした。",
        );
        return;
      }

      setMessage("完成版として保存しました。");
      onFinalized();
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border p-6">
      <h2 className="font-semibold">完成保存</h2>

      <p className="mt-2 text-sm text-muted-foreground">
        完成度スコアが十分になったら、ルールを完成版として保存できます。
      </p>

      <p className="mt-3 text-sm">現在のスコア: {completionScore ?? 0}/100</p>

      {message ? (
        <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleFinalize()}
        disabled={isSaving || !canFinalize}
        className="mt-4 w-full rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isSaving ? "保存中..." : "完成版として保存"}
      </button>

      {!canFinalize ? (
        <p className="mt-2 text-xs text-muted-foreground">
          まだ不足項目があります。AIレビューの指摘を確認してください。
        </p>
      ) : null}
    </section>
  );
}
