"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type {
  previewCsv,
  listImportBatches,
  Resolution,
} from "@/features/csv-import/service";
import { formatTransactionPrice } from "@/features/transactions/format";

type Preview = Awaited<ReturnType<typeof previewCsv>>;
type Batches = ReturnType<typeof listImportBatches>;
type ReviewResolution = Resolution;

const fieldLabels: Record<string, string> = {
  name: "銘柄名",
  ticker: "銘柄コード",
  market: "市場",
  marketCode: "市場コード",
  side: "売買",
  quantity: "数量",
  price: "価格",
  executedDate: "約定日",
  fee: "手数料",
  priceCurrency: "価格の通貨",
  feeCurrency: "手数料の通貨",
  settlementDate: "受渡日",
  settlementCurrency: "受渡通貨",
  settlementAmount: "受渡金額",
  exchangeRate: "為替レート",
  accountType: "口座区分",
};

function displayValue(value: string | number | null | undefined) {
  return value == null || value === "" ? "（空欄）" : String(value);
}

function csvFieldValue(
  row: Preview["rows"][number]["transaction"],
  field: string,
) {
  if (field === "name") return row.stockName;
  if (field === "ticker") return row.ticker ?? null;
  if (field === "market" || field === "marketCode") return row.marketCode;
  if (field === "executedDate") return row.executedAt.slice(0, 10);
  return row[field as keyof typeof row] as string | number | null | undefined;
}

async function send(form: FormData) {
  const response = await fetch("/api/import", { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "CSVを読み込めませんでした。");
  return data;
}

export function ImportPanel({ batches }: { batches: Batches }) {
  const router = useRouter();
  const fileRef = useRef<File | null>(null);
  const requestVersion = useRef(0);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewActions, setReviewActions] = useState<
    Record<number, "merge" | "new" | "skip">
  >({});
  const [reviewCandidates, setReviewCandidates] = useState<
    Record<number, string>
  >({});
  const [fieldChoices, setFieldChoices] = useState<
    Record<string, "manual" | "csv">
  >({});
  async function selectFile(file: File | undefined) {
    const version = ++requestVersion.current;
    fileRef.current = file ?? null;
    setFileName(file?.name ?? "");
    setPreview(null);
    setReviewActions({});
    setReviewCandidates({});
    setFieldChoices({});
    setError(null);
    setMessage(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("CSVは10MB以下にしてください。");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.set("operation", "preview");
    form.set("file", file);
    try {
      const data = await send(form);
      if (version === requestVersion.current) setPreview(data);
    } catch (cause) {
      if (version === requestVersion.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "CSVを読み込めませんでした。",
        );
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }
  async function confirmImport() {
    if (!fileRef.current || !preview) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.set("operation", "import");
    form.set("file", fileRef.current);
    form.set("digest", preview.digest);
    const resolutions: ReviewResolution[] = preview.rows
      .filter(({ status }) => status === "review")
      .map((row) => {
        const sourceRowNumber = row.transaction.sourceRowNumber;
        const action = reviewActions[sourceRowNumber];
        const candidate =
          row.candidates.find(
            ({ id }) => id === reviewCandidates[sourceRowNumber],
          ) ?? (row.candidates.length === 1 ? row.candidates[0] : undefined);
        return {
          sourceRowNumber,
          action: action ?? "skip",
          ...(action === "merge" && candidate
            ? { transactionId: candidate.id }
            : {}),
          ...(action === "merge" && candidate
            ? {
                fields: Object.fromEntries(
                  candidate.conflicts.map((field) => [
                    field,
                    fieldChoices[`${sourceRowNumber}:${field}`] ?? "csv",
                  ]),
                ),
              }
            : {}),
        };
      });
    form.set("resolutions", JSON.stringify(resolutions));
    try {
      const result = await send(form);
      setMessage(
        result.mergedCount > 0
          ? `${result.importedCount}件をインポートし、${result.mergedCount}件を既存の取引に統合しました。`
          : `${result.importedCount}件をインポートしました。`,
      );
      setPreview(null);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "インポートできませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  async function undo(id: string) {
    if (
      !window.confirm(
        "このインポートで作成した取引を取り消します。手入力の取引は残り、取り込んだ項目は現在の値が変わっていない場合だけ元に戻ります。続けますか？",
      )
    )
      return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.set("operation", "undo");
    form.set("batchId", id);
    try {
      await send(form);
      setPreview(null);
      setMessage("インポートを取り消しました。");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "取り消せませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  const unresolvedReview =
    preview?.rows.some(({ status, transaction, candidates }) => {
      if (status !== "review") return false;
      const action = reviewActions[transaction.sourceRowNumber];
      const selected = reviewCandidates[transaction.sourceRowNumber];
      const candidateChosen =
        candidates.length === 1 || candidates.some(({ id }) => id === selected);
      return !action || (action === "merge" && !candidateChosen);
    }) ?? false;
  const hasImportWork = preview
    ? preview.counts.new + preview.counts.merged + preview.counts.review > 0
    : false;
  return (
    <>
      <section className="mt-10 border-t pt-6" aria-labelledby="import-heading">
        <h2 id="import-heading" className="text-lg font-semibold">
          取引履歴を読み込む
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          楽天証券の日本株・米国株、SBI証券・野村證券・マネックス証券の日本株CSVに対応しています。投資信託は対象外です。
        </p>
        <label className="mt-4 block text-sm">
          CSVを選択
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border file:bg-background file:px-3 file:py-2"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void selectFile(file);
            }}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          10MB以下。内容を確認してから保存します。
        </p>
        {busy && (
          <p role="status" className="mt-3 text-sm">
            処理しています…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-3 text-sm">
            {message}
          </p>
        )}
        {preview && (
          <div className="mt-5 space-y-4">
            <h3 className="break-all font-medium">{fileName}</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {(
                [
                  ["新規", preview.counts.new],
                  ["CSVの重複", preview.counts.duplicate],
                  ["手入力取引と自動統合", preview.counts.merged],
                  ["対象外", preview.counts.excluded],
                  ["要確認", preview.counts.review + preview.counts.unknown],
                ] as const
              ).map(([label, count]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className="mt-1 font-semibold">{count}件</dd>
                </div>
              ))}
            </dl>
            <details open>
              <summary className="cursor-pointer text-sm font-medium">
                取引の確認
              </summary>
              <ul className="mt-2 max-h-96 divide-y overflow-auto border-y">
                {preview.rows.map(
                  (
                    { transaction: row, status, warning, candidates },
                    index,
                  ) => (
                    <li key={index} className="py-3 text-sm">
                      <p className="break-words font-medium">
                        {row.ticker} {row.stockName}{" "}
                        <span className="font-normal text-muted-foreground">
                          {status === "new"
                            ? "新規"
                            : status === "duplicate"
                              ? "重複"
                              : status === "merged"
                                ? "統合"
                                : "要確認"}
                        </span>
                      </p>
                      <p>
                        {row.executedAt.slice(0, 10)} ·{" "}
                        {row.side === "buy" ? "購入" : "売却"} {row.quantity}株
                        · {formatTransactionPrice(row.price, row.priceCurrency)}
                      </p>
                      {row.accountType && (
                        <p className="text-muted-foreground">
                          {row.accountType}
                        </p>
                      )}
                      {warning && (
                        <p className="mt-1 text-muted-foreground">{warning}</p>
                      )}
                      {status === "merged" && (
                        <div className="mt-1 text-muted-foreground">
                          <p>
                            手入力の取引にCSVの不足情報を反映します。新しい取引は作成しません。
                          </p>
                          {candidates[0]?.updates.map((update) => (
                            <p key={update.field}>
                              {fieldLabels[update.field] ?? update.field}:{" "}
                              {displayValue(update.before)} →{" "}
                              {displayValue(update.after)}
                            </p>
                          ))}
                        </div>
                      )}
                      {status === "review" && (
                        <div className="mt-3 space-y-3 rounded-lg border p-3">
                          <p className="font-medium">
                            既存の取引と照合してください
                          </p>
                          {candidates.length > 0 && (
                            <label className="block">
                              照合する既存取引
                              <select
                                className="mt-1 block w-full rounded border bg-background p-2"
                                value={
                                  reviewCandidates[row.sourceRowNumber] ??
                                  (candidates.length === 1
                                    ? candidates[0].id
                                    : "")
                                }
                                onChange={(event) =>
                                  setReviewCandidates((current) => ({
                                    ...current,
                                    [row.sourceRowNumber]: event.target.value,
                                  }))
                                }
                              >
                                {candidates.length > 1 && (
                                  <option value="">
                                    既存取引を選択してください
                                  </option>
                                )}
                                {candidates.map((candidate) => (
                                  <option
                                    key={candidate.id}
                                    value={candidate.id}
                                  >
                                    {candidate.values.name ?? candidate.stockId}
                                    {candidate.values.ticker
                                      ? `（${candidate.values.ticker}）`
                                      : ""}
                                    {` · ${displayValue(candidate.values.executedDate)} · ${candidate.values.side === "buy" ? "購入" : "売却"} ${displayValue(candidate.values.quantity)}株`}
                                    {` · ${formatTransactionPrice(typeof candidate.values.price === "number" ? candidate.values.price : null, typeof candidate.values.priceCurrency === "string" ? candidate.values.priceCurrency : row.priceCurrency)}`}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          {(() => {
                            const candidate =
                              candidates.find(
                                ({ id }) =>
                                  id === reviewCandidates[row.sourceRowNumber],
                              ) ??
                              (candidates.length === 1
                                ? candidates[0]
                                : undefined);
                            if (!candidate)
                              return (
                                <p>
                                  {candidates.length > 1
                                    ? "既存取引を選択してください。"
                                    : "照合候補がありません。別の取引として追加するか、今回はインポートしないを選んでください。"}
                                </p>
                              );
                            const comparisonFields = [
                              ...new Set([
                                "name",
                                "ticker",
                                "executedDate",
                                "side",
                                "quantity",
                                "price",
                                ...candidate.conflicts,
                                ...candidate.updates.map(({ field }) => field),
                              ]),
                            ];
                            return (
                              <div className="space-y-2">
                                <div className="overflow-x-auto rounded border">
                                  <table className="min-w-[28rem] w-full text-left text-xs">
                                    <thead>
                                      <tr className="border-b bg-muted/50">
                                        <th className="p-2">項目</th>
                                        <th className="p-2">手入力</th>
                                        <th className="p-2">CSV</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {comparisonFields.map((field) => {
                                        const valueText = (
                                          value:
                                            | string
                                            | number
                                            | null
                                            | undefined,
                                        ) =>
                                          field === "side"
                                            ? value === "buy"
                                              ? "購入"
                                              : value === "sell"
                                                ? "売却"
                                                : displayValue(value)
                                            : displayValue(value);
                                        return (
                                          <tr
                                            key={field}
                                            className="border-b last:border-0"
                                          >
                                            <th className="p-2 font-medium">
                                              {fieldLabels[field] ?? field}
                                            </th>
                                            <td className="p-2">
                                              {valueText(
                                                candidate.values[field],
                                              )}
                                            </td>
                                            <td className="p-2">
                                              {valueText(
                                                csvFieldValue(row, field),
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                {reviewActions[row.sourceRowNumber] ===
                                  "merge" &&
                                  candidate.conflicts.map((field) => (
                                    <fieldset
                                      key={field}
                                      className="rounded border p-2"
                                    >
                                      <legend>
                                        {fieldLabels[field] ?? field}
                                      </legend>
                                      <label className="mr-4 inline-flex gap-1">
                                        <input
                                          type="radio"
                                          name={`field-${row.sourceRowNumber}-${field}`}
                                          checked={
                                            (fieldChoices[
                                              `${row.sourceRowNumber}:${field}`
                                            ] ?? "csv") === "manual"
                                          }
                                          onChange={() =>
                                            setFieldChoices((current) => ({
                                              ...current,
                                              [`${row.sourceRowNumber}:${field}`]:
                                                "manual",
                                            }))
                                          }
                                        />
                                        既存:{" "}
                                        {displayValue(candidate.values[field])}
                                      </label>
                                      <label className="inline-flex gap-1">
                                        <input
                                          type="radio"
                                          name={`field-${row.sourceRowNumber}-${field}`}
                                          checked={
                                            (fieldChoices[
                                              `${row.sourceRowNumber}:${field}`
                                            ] ?? "csv") === "csv"
                                          }
                                          onChange={() =>
                                            setFieldChoices((current) => ({
                                              ...current,
                                              [`${row.sourceRowNumber}:${field}`]:
                                                "csv",
                                            }))
                                          }
                                        />
                                        CSV:{" "}
                                        {displayValue(
                                          csvFieldValue(row, field),
                                        )}
                                      </label>
                                    </fieldset>
                                  ))}
                                {reviewActions[row.sourceRowNumber] ===
                                  "merge" && (
                                  <p className="text-muted-foreground">
                                    未設定の項目は値のある側で補完します。銘柄名はCSVの正式名称に更新します。
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                ["merge", "同じ取引として統合"],
                                ["new", "別の取引として追加"],
                                ["skip", "今回はインポートしない"],
                              ] as const
                            ).map(([action, label]) => (
                              <button
                                key={action}
                                type="button"
                                aria-pressed={
                                  reviewActions[row.sourceRowNumber] === action
                                }
                                onClick={() =>
                                  setReviewActions((current) => ({
                                    ...current,
                                    [row.sourceRowNumber]: action,
                                  }))
                                }
                                className={`rounded-lg border px-3 py-2 ${reviewActions[row.sourceRowNumber] === action ? "bg-primary text-primary-foreground" : ""}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ),
                )}
              </ul>
            </details>
            {preview.excluded.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm">
                  対象外 {preview.excluded.length}件
                </summary>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {preview.excluded.map((row, index) => (
                    <li key={index}>
                      行 {row.sourceRowNumber}: {row.sourceTradeType} —{" "}
                      {row.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {preview.unknown.length > 0 && (
              <div className="rounded-lg border border-destructive/40 p-3">
                <h3 className="text-sm font-semibold">
                  要確認（保存されません）
                </h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {preview.unknown.map((row, index) => (
                    <li key={index}>
                      行 {row.sourceRowNumber}: {row.stockName} ·{" "}
                      {row.sourceTradeType}
                      <p className="text-muted-foreground">{row.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              disabled={busy || unresolvedReview || !hasImportWork}
              onClick={() => void confirmImport()}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {preview.counts.merged === 0 && preview.counts.review === 0
                ? `${preview.counts.new}件をインポート`
                : `${preview.counts.new + preview.counts.merged + preview.rows.filter(({ status, transaction }) => status === "review" && reviewActions[transaction.sourceRowNumber] !== "skip").length}件を反映`}
            </button>
          </div>
        )}
      </section>
      <section
        className="mt-10 border-t pt-6"
        aria-labelledby="history-heading"
      >
        <h2 id="history-heading" className="text-lg font-semibold">
          インポート履歴
        </h2>
        {batches.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            インポート履歴はまだありません。
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {batches.map((batch) => (
              <li
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
              >
                <div className="min-w-0">
                  <p className="break-all font-medium">{batch.fileName}</p>
                  <p className="mt-1 text-muted-foreground">
                    {new Date(batch.importedAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}{" "}
                    · 新規 {batch.importedCount}件 · 統合 {batch.mergedCount}件
                    {batch.status === "undone" ? " · 取り消し済み" : ""}
                  </p>
                </div>
                {batch.status !== "undone" && (
                  <button
                    disabled={busy}
                    onClick={() => void undo(batch.id)}
                    className="rounded-lg border px-3 py-2 disabled:opacity-50"
                  >
                    取り消す
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
