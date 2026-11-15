"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  listCaptureTransactionsAction,
  saveDecisionAction,
} from "@/features/decisions/actions";
import {
  findTransactionCandidates,
  initialDecisionType,
  japanDate,
} from "@/features/transactions/matching";
import { LinkedTransactionSelector } from "@/features/capture/linked-transaction-selector";
import {
  ReviewSchedule,
  resolveReviewDates,
  type ReviewScheduleValue,
} from "@/features/capture/review-schedule";
import { decisionTypeLabel } from "@/features/decisions/decision-display";
import type { Stock } from "@/schemas/stock";
import type { DecisionType } from "@/schemas/decision";
import type { Transaction } from "@/schemas/transaction";

function localDateInputValue(date = new Date()) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 10);
}

export function CaptureForm({
  stocks,
  fixedStock,
  transactions: suppliedTransactions,
  initialTransaction,
}: {
  stocks: Stock[];
  fixedStock?: Stock;
  transactions?: Transaction[];
  initialTransaction?: Transaction;
}) {
  const router = useRouter();
  const [rawInput, setRawInput] = useState("");
  const [stockChoice, setStockChoice] = useState(
    fixedStock ? `existing:${fixedStock.id}` : "new",
  );
  const [stockName, setStockName] = useState("");
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<DecisionType>(
    initialTransaction ? initialDecisionType(initialTransaction) : "note",
  );
  const [summary, setSummary] = useState("");
  const [points, setPoints] = useState<string[]>([]);
  const [decisionDate, setDecisionDate] = useState(
    initialTransaction
      ? japanDate(initialTransaction.executedAt)
      : japanDate(new Date()),
  );
  const [reviewSchedule, setReviewSchedule] = useState<ReviewScheduleValue>({
    choices: [],
    earningsDate: "",
    dates: [""],
  });
  const [recordTrade, setRecordTrade] = useState(Boolean(initialTransaction));
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">(
    initialTransaction?.side ?? "buy",
  );
  const [tradeQuantity, setTradeQuantity] = useState(
    initialTransaction ? String(initialTransaction.quantity) : "",
  );
  const [tradePrice, setTradePrice] = useState(
    initialTransaction?.price == null ? "" : String(initialTransaction.price),
  );
  const [tradeDate, setTradeDate] = useState(
    initialTransaction
      ? localDateInputValue(new Date(initialTransaction.executedAt))
      : localDateInputValue(),
  );
  const [fetchedTransactions, setFetchedTransactions] = useState<{
    stockId: string;
    items: Transaction[];
  } | null>(null);
  const [transactionFetchError, setTransactionFetchError] = useState<{
    stockId: string;
    message: string;
  } | null>(null);
  const [transactionSelection, setTransactionSelection] = useState<{
    key: string;
    id: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedStock =
    fixedStock ??
    (stockChoice.startsWith("existing:")
      ? stocks.find((item) => item.id === stockChoice.slice(9))
      : undefined);
  const effectiveStockId = selectedStock?.id;
  useEffect(() => {
    if (!effectiveStockId || suppliedTransactions) return;
    let active = true;
    void listCaptureTransactionsAction({ stockId: effectiveStockId })
      .then((items) => {
        if (active) {
          setFetchedTransactions({ stockId: effectiveStockId, items });
          setTransactionFetchError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setTransactionFetchError({
            stockId: effectiveStockId,
            message:
              cause instanceof Error
                ? cause.message
                : "売買履歴を読み込めませんでした。",
          });
      });
    return () => {
      active = false;
    };
  }, [effectiveStockId, suppliedTransactions]);
  const availableTransactions =
    suppliedTransactions ??
    (effectiveStockId && fetchedTransactions?.stockId === effectiveStockId
      ? fetchedTransactions.items
      : []);
  const candidates = effectiveStockId
    ? findTransactionCandidates(
        availableTransactions,
        type,
        decisionDate,
        effectiveStockId,
      )
    : [];
  const selectionKey = `${effectiveStockId ?? "new"}:${type}:${decisionDate}`;
  const defaultTransactionId =
    initialTransaction &&
    candidates.some((item) => item.id === initialTransaction.id)
      ? initialTransaction.id
      : candidates.length === 1
        ? candidates[0].id
        : null;
  const selectedTransactionId =
    transactionSelection?.key === selectionKey
      ? transactionSelection.id
      : defaultTransactionId;
  const linkedTransaction =
    candidates.find((item) => item.id === selectedTransactionId) ?? null;
  const candidatesLoading = Boolean(
    effectiveStockId &&
    !suppliedTransactions &&
    fetchedTransactions?.stockId !== effectiveStockId &&
    transactionFetchError?.stockId !== effectiveStockId,
  );
  const candidatesError =
    effectiveStockId && transactionFetchError?.stockId === effectiveStockId
      ? transactionFetchError.message
      : null;

  async function save() {
    if (!rawInput.trim()) return setError("記録する内容を入力してください。");
    if (candidatesLoading || candidatesError)
      return setError(
        candidatesError ?? "売買履歴の読み込みが完了するまで保存できません。",
      );
    const name = selectedStock?.name ?? stockName.trim();
    if (!name) return setError("銘柄名を入力してください。");
    if (
      reviewSchedule.choices.includes("earnings") &&
      !reviewSchedule.earningsDate
    )
      return setError("次の決算日を入力してください。");
    if (
      reviewSchedule.choices.includes("date") &&
      reviewSchedule.dates.some((date) => !date)
    )
      return setError("振り返り日を入力してください。");
    if (
      recordTrade &&
      !linkedTransaction &&
      (!tradeQuantity || Number(tradeQuantity) <= 0)
    )
      return setError("売買履歴を追加する場合は数量を入力してください。");
    if (stockChoice === "new") {
      const duplicate = stocks.find(
        (item) =>
          (ticker.trim() &&
            item.ticker?.toUpperCase() === ticker.trim().toUpperCase()) ||
          item.name.normalize("NFKC").trim().toLocaleLowerCase("ja-JP") ===
            name.normalize("NFKC").trim().toLocaleLowerCase("ja-JP"),
      );
      if (duplicate)
        return setError(
          `「${duplicate.name}」は登録済みです。既存銘柄を選択してください。`,
        );
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveDecisionAction({
        type,
        stock: {
          name,
          ticker: selectedStock?.ticker ?? (ticker.trim() || null),
          market: selectedStock?.market ?? null,
        },
        summary: summary.trim() || null,
        points: points
          .map((text) => ({
            kind: "other" as const,
            text,
            source: "raw_input" as const,
          }))
          .filter((point) => point.text.trim()),
        transaction: null,
        rawInput: rawInput.trim(),
        transcript: null,
        followUpAnswer: null,
        followUpQuestion: null,
        reviewDates: resolveReviewDates(reviewSchedule),
        decidedAt: decisionDate,
        existingTransactionId: linkedTransaction?.id ?? null,
        transactionInput:
          recordTrade && !linkedTransaction
            ? {
                side: tradeSide,
                quantity: Number(tradeQuantity),
                price: tradePrice ? Number(tradePrice) : null,
                fee: null,
                executedAt: new Date(
                  `${tradeDate}T12:00:00.000Z`,
                ).toISOString(),
              }
            : null,
        ...(effectiveStockId ? { stockId: effectiveStockId } : {}),
      });
      router.push(`/stocks/${saved.stockId}`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "保存できませんでした。入力内容を確認してください。",
      );
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="page-title">考えを記録する</h1>
        <p className="text-sm text-muted-foreground">
          文章を読み返しながら、必要な項目を自分で整理して保存します。
        </p>
      </section>
      {!fixedStock && (
        <label className="block text-sm text-muted-foreground">
          記録対象の銘柄
          <select
            value={stockChoice}
            onChange={(event) => setStockChoice(event.target.value)}
            className="input mt-1 text-foreground"
          >
            <option value="new">新しい銘柄として登録</option>
            {stocks.map((item) => (
              <option key={item.id} value={`existing:${item.id}`}>
                既存の銘柄: {item.name}
                {item.ticker ? ` (${item.ticker})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {fixedStock && (
        <p className="text-sm">
          記録する銘柄：<strong>{fixedStock.name}</strong>
        </p>
      )}
      <section className="surface space-y-4 p-5">
        <label className="block text-sm text-muted-foreground">
          いま考えていること
          <textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            rows={7}
            placeholder="判断の理由や、考え直す条件などを自分の言葉で記録します。"
            className="journal-text input mt-2 w-full text-foreground"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {!selectedStock && (
            <>
              <label className="text-sm text-muted-foreground">
                銘柄名
                <input
                  value={stockName}
                  onChange={(event) => setStockName(event.target.value)}
                  className="input mt-1 text-foreground"
                />
              </label>
              <label className="text-sm text-muted-foreground">
                証券コード（任意）
                <input
                  value={ticker}
                  onChange={(event) => setTicker(event.target.value)}
                  className="input mt-1 text-foreground"
                />
              </label>
            </>
          )}
          <label className="text-sm text-muted-foreground">
            判断した日
            <input
              type="date"
              value={decisionDate}
              onChange={(event) => setDecisionDate(event.target.value)}
              className="input mt-1 text-foreground"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            記録の種類
            <select
              value={type}
              onChange={(event) => setType(event.target.value as DecisionType)}
              className="input mt-1 text-foreground"
            >
              {Object.entries(decisionTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm text-muted-foreground">
          要約（任意）
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={2}
            className="input mt-1 w-full text-foreground"
          />
        </label>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">整理した点（任意）</p>
          {points.map((point, index) => (
            <div className="flex gap-2" key={index}>
              <input
                aria-label={`整理した点 ${index + 1}`}
                value={point}
                onChange={(event) =>
                  setPoints((current) =>
                    current.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  )
                }
                className="input text-foreground"
              />
              <button
                type="button"
                onClick={() =>
                  setPoints((current) => current.filter((_, i) => i !== index))
                }
                className="button-soft"
              >
                削除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPoints((current) => [...current, ""])}
            className="text-sm font-medium text-primary"
          >
            点を追加
          </button>
        </div>
        {effectiveStockId && candidatesError && (
          <p role="alert" className="text-sm text-destructive">
            {candidatesError}
          </p>
        )}
        {effectiveStockId && (
          <LinkedTransactionSelector
            transactions={candidates}
            value={selectedTransactionId}
            onChange={(id) =>
              setTransactionSelection({ key: selectionKey, id })
            }
            loading={candidatesLoading}
            disabled={saving || Boolean(candidatesError)}
          />
        )}
        {!linkedTransaction && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={recordTrade}
              onChange={(event) => setRecordTrade(event.target.checked)}
              className="size-5 accent-primary"
            />
            売買の事実も履歴に記録する
          </label>
        )}
        {recordTrade && !linkedTransaction && (
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm text-muted-foreground">
              売買
              <select
                value={tradeSide}
                onChange={(event) =>
                  setTradeSide(event.target.value as "buy" | "sell")
                }
                className="input mt-1 text-foreground"
              >
                <option value="buy">購入</option>
                <option value="sell">売却</option>
              </select>
            </label>
            <label className="text-sm text-muted-foreground">
              数量
              <input
                type="number"
                min="0.0001"
                step="any"
                value={tradeQuantity}
                onChange={(event) => setTradeQuantity(event.target.value)}
                className="input mt-1 text-foreground"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              単価（任意）
              <input
                type="number"
                min="0"
                step="any"
                value={tradePrice}
                onChange={(event) => setTradePrice(event.target.value)}
                className="input mt-1 text-foreground"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              約定日
              <input
                type="date"
                value={tradeDate}
                onChange={(event) => setTradeDate(event.target.value)}
                className="input mt-1 text-foreground"
              />
            </label>
          </div>
        )}
        <ReviewSchedule value={reviewSchedule} onChange={setReviewSchedule} />
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="action-bar">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || candidatesLoading || Boolean(candidatesError)}
          className="button-primary min-h-14 w-full"
        >
          <Check size={18} aria-hidden />
          {saving ? "保存しています…" : "この内容で保存"}
        </button>
      </div>
    </div>
  );
}
