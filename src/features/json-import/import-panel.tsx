"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

const resultSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});

export function JsonImportPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function importFile() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("JSONファイルは20MB以内にしてください。");
      const response = await fetch("/api/import/json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: file,
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const failure = z.object({ error: z.string() }).safeParse(data);
        throw new Error(
          failure.success
            ? failure.data.error
            : "JSONをインポートできませんでした。",
        );
      }
      const result = resultSchema.parse(data);
      setMessage(
        `${result.importedCount}件の記録を取り込みました。同じ内容の記録${result.skippedCount}件は追加しませんでした。`,
      );
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "JSONをインポートできませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground" id="json-import-description">
        エクスポートしたJSONを読み込みます（20MBまで）。既存の記録は上書きしません。同じ内容の記録は追加せず、同じ識別子で内容が異なる場合は取り込みを中止します。
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-0 text-sm">
          JSONファイル
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            disabled={busy}
            aria-describedby="json-import-description"
            className="mt-1 block w-full max-w-full text-sm"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
              setMessage(null);
            }}
          />
        </label>
        <button
          type="button"
          disabled={!file || busy}
          onClick={importFile}
          className="button-soft"
        >
          {busy ? "JSONを取り込み中…" : "JSONをインポート"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
