"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { BUCKET_OPTIONS, bucketLabel } from "@/features/stocks/bucket";
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

function formatMonthDay(value: string): string {
  return new Date(value).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  });
}

/** 一覧の行と銘柄詳細で同じ区分の表示を使う。未分類は分類漏れの事実として破線で示し、警告色は使わない */
export function BucketBadge({ bucket }: { bucket: Bucket }) {
  return bucket === "unclassified" ? (
    <span className="inline-flex items-center rounded-md border border-dashed border-muted-foreground/50 px-1.5 text-xs text-muted-foreground">
      未分類
    </span>
  ) : (
    <span className="text-xs font-medium text-foreground">
      {bucketLabel(bucket)}
    </span>
  );
}

function BucketSegment({
  value,
  onChange,
  disabled,
  label,
}: {
  value: Bucket;
  onChange: (bucket: Bucket) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1"
    >
      {BUCKET_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className="min-h-10 rounded-lg px-2 text-sm text-muted-foreground transition-colors aria-checked:bg-card aria-checked:font-semibold aria-checked:text-foreground aria-checked:shadow-[0_1px_2px_rgb(23_32_27/0.08)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ConfirmText({ from, to }: { from: Bucket; to: Bucket }) {
  return (
    <p className="text-sm">
      「{bucketLabel(from)}」→「{bucketLabel(to)}
      」に変更します。変更は履歴に残ります。
    </p>
  );
}

/**
 * 銘柄詳細の統計グリッドと区分の変更カード。グリッドの他の欄はサーバー側で描いて children で受け取る。
 * 確認は別ダイアログにせず、保存ボタンの直前に確認文を出す（設計案 判断 3-2）。
 */
export function BucketEditor({
  stockId,
  bucket,
  history,
  children,
}: {
  stockId: string;
  bucket: Bucket;
  history: StockBucketChange[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Bucket>(bucket);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const lastChange = history.at(-1);

  function toggle() {
    setOpen((current) => !current);
    setSelected(bucket);
    setReason("");
    setError(null);
    setMessage(null);
  }

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
      setOpen(false);
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
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2">
        {children}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2.5">
          <div>
            <dt className="text-[11px] text-muted-foreground">区分</dt>
            <dd className="mt-0.5">
              <BucketBadge bucket={bucket} />
            </dd>
          </div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="bucket-change-card"
            onClick={toggle}
            className="min-h-9 rounded-lg px-2 text-sm font-semibold text-primary"
          >
            {open ? "閉じる" : "変更"}
          </button>
        </div>
      </dl>

      {open && (
        <section
          id="bucket-change-card"
          className="surface space-y-3 p-5"
          aria-labelledby="bucket-heading"
        >
          <h2 id="bucket-heading" className="font-semibold">
            区分の変更
          </h2>
          <p className="text-xs leading-5 text-muted-foreground">
            コアはインデックスなど判断を介在させない資産、サテライトは個別株など自分で動かす資産です。
          </p>
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            <BucketSegment
              label="区分"
              value={selected}
              onChange={setSelected}
              disabled={saving}
            />
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
            {selected !== bucket && <ConfirmText from={bucket} to={selected} />}
            <button
              type="submit"
              disabled={saving || selected === bucket}
              className="button-soft w-full sm:w-auto"
            >
              {saving ? "変更しています…" : "区分を保存"}
            </button>
          </form>
        </section>
      )}
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
          区分の変更履歴 {history.length}件
          {lastChange ? ` · 最後 ${formatMonthDay(lastChange.changedAt)}` : ""}
        </summary>
        {history.length === 0 ? (
          <p className="pb-3 text-muted-foreground">
            変更履歴はまだありません。
          </p>
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
                {change.reason ? (
                  <p className="journal-text mt-0.5">{change.reason}</p>
                ) : (
                  <p className="mt-0.5 text-muted-foreground">理由なし</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </details>
    </div>
  );
}

/** 保有一覧の行で区分を変える。押した時点では保存せず、確認行で「変更を保存」を押したときだけ保存する */
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
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await changeStockBucketAction({
        stockId,
        bucket: selected,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(
        `区分を「${bucketLabel(result.bucket)}」に変更しました。理由は銘柄詳細で残せます。`,
      );
      router.refresh();
    } catch {
      setError("区分を変更できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="col-span-2 space-y-2">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-sm text-muted-foreground">区分</span>
        <div className="flex-1">
          <BucketSegment
            label="区分"
            value={selected}
            disabled={saving}
            onChange={(next) => {
              setSelected(next);
              setError(null);
              setMessage(null);
            }}
          />
        </div>
      </div>
      {selected !== bucket && (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <ConfirmText from={bucket} to={selected} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="button-soft"
            >
              {saving ? "変更しています…" : "変更を保存"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setSelected(bucket)}
              className="min-h-11 px-2 text-sm text-muted-foreground"
            >
              やめる
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs text-primary">
          {message}
        </p>
      )}
    </div>
  );
}
