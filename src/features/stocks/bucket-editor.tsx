"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  BUCKET_OPTIONS,
  bucketLabel,
} from "@/features/stocks/bucket";
import { changeStockBucketAction } from "@/features/stocks/actions";
import type { Bucket, StockBucketChange } from "@/schemas/stock";

function formatChangedAt(value: string): string {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BucketEditor({
  stockId,
  bucket,
  history,
}: {
  stockId: string;
  bucket: Bucket;
  history: StockBucketChange[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Bucket>(bucket);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await changeStockBucketAction({
        stockId,
        bucket: selected,
        reason,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setReason("");
      setMessage(
        result.changed
          ? `区分を「${bucketLabel(result.bucket)}」に変更しました。`
          : "区分は変わっていません。",
      );
      router.refresh();
    } catch {
      setError("区分を変更できませんでした。時間をおいて再度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="surface space-y-3 p-5"
      aria-labelledby="bucket-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bucket-heading" className="font-semibold">
          区分
        </h2>
        <span className="chip">現在: {bucketLabel(bucket)}</span>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        コアはインデックスなど判断を介在させない資産、サテライトは個別株など自分で動かす資産です。変更は履歴に残ります。
      </p>
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <label className="block text-sm text-muted-foreground">
          区分
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value as Bucket)}
            className="input mt-1 text-foreground"
          >
            {BUCKET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-muted-foreground">
          変更理由（任意）
          <input
            type="text"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="例: 買う前にコアと決めていた"
            className="input mt-1 text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={saving || selected === bucket}
          className="button-soft w-full sm:w-auto"
        >
          {saving ? "変更しています…" : "区分を保存"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      <details className="rounded-xl bg-secondary/60 px-3 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">
          区分の変更履歴（{history.length}件）
        </summary>
        {history.length === 0 ? (
          <p className="pb-3 text-muted-foreground">変更履歴はまだありません。</p>
        ) : (
          <ol className="space-y-3 pb-3">
            {[...history].reverse().map((change) => (
              <li key={change.id}>
                <p className="font-mono text-xs text-muted-foreground">
                  {formatChangedAt(change.changedAt)}
                </p>
                <p className="mt-0.5">
                  {bucketLabel(change.fromBucket)} →{" "}
                  <span className="font-semibold">
                    {bucketLabel(change.toBucket)}
                  </span>
                </p>
                {change.reason && (
                  <p className="mt-0.5 text-muted-foreground">
                    理由: {change.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}

export function BucketQuickSelect({
  stockId,
  bucket,
}: {
  stockId: string;
  bucket: Bucket;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Bucket>(bucket);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: Bucket) {
    setSelected(next);
    setSaving(true);
    setError(null);
    try {
      const result = await changeStockBucketAction({ stockId, bucket: next });
      if (!result.ok) {
        setSelected(bucket);
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setSelected(bucket);
      setError("区分を変更できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="col-span-2 flex flex-wrap items-center justify-between gap-2">
      <label className="text-sm text-muted-foreground">
        区分
        <select
          value={selected}
          disabled={saving}
          onChange={(event) => void change(event.target.value as Bucket)}
          className="input mt-1 text-foreground"
        >
          {BUCKET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
