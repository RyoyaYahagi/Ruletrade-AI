"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountDeletePanel() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/delete/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deletionType: "account",
          confirmText,
          reason: reason || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "アカウント削除に失敗しました。");
        return;
      }
      router.replace("/");
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-semibold text-red-900">アカウント削除</h2>
      <p className="mt-2 text-sm text-red-800">
        アカウントと保存データを削除します。この操作は取り消せません。続行するには
        DELETE と入力してください。
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="任意: 削除理由"
        rows={3}
        className="mt-4 w-full rounded-md border px-3 py-2"
      />
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="DELETE"
        className="mt-3 w-full rounded-md border px-3 py-2"
      />
      {error ? (
        <p className="mt-4 rounded-md bg-white p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting || confirmText !== "DELETE"}
        className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {deleting ? "削除中..." : "アカウントを削除する"}
      </button>
    </section>
  );
}
