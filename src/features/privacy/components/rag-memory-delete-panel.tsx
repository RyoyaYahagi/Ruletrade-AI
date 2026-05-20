"use client";

import { useState } from "react";

export function RagMemoryDeletePanel() {
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !window.confirm(
        "AIが参照するRAGメモリを削除します。元のルールや資料は削除されません。続行しますか？",
      )
    )
      return;
    setDeleting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/privacy/delete/rag-memory", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "削除に失敗しました。");
        return;
      }
      setMessage("RAGメモリを削除しました。");
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold">AIメモリ削除</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        過去ルールやメモから作られたRAG用データを削除します。元データは残ります。
      </p>
      {message ? (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        className="mt-4 rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
      >
        {deleting ? "削除中..." : "AIメモリを削除する"}
      </button>
    </section>
  );
}
