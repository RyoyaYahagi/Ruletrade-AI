"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Mic, Square, WandSparkles } from "lucide-react";
import { listCaptureTransactionsAction, saveDecisionAction } from "@/features/decisions/actions";
import { findTransactionCandidates, initialDecisionType, japanDate } from "@/features/transactions/matching";
import { LinkedTransactionSelector } from "@/features/capture/linked-transaction-selector";
import { DecisionExtractionSchema, type DecisionExtraction } from "@/schemas/decision";
import type { Stock } from "@/schemas/stock";
import type { Transaction } from "@/schemas/transaction";
import { useVoiceTranscription } from "@/features/capture/use-voice-transcription";

type CaptureMode = "writing" | "extracting" | "confirming" | "saving";

const initialExtraction: DecisionExtraction = {
  stock: { ticker: null, name: "", market: null },
  type: "note",
  thesis: null,
  assumptions: [],
  reviewConditions: [],
  addConditions: [],
  followUpQuestion: null,
  transaction: null,
};

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-・]\s*/, "").trim())
    .filter(Boolean);
}

function localDateInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
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
  const [transcript, setTranscript] = useState<string | null>(null);
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [askedQuestion, setAskedQuestion] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("writing");
  const [extraction, setExtraction] = useState<DecisionExtraction>(initialExtraction);
  const [stockChoice, setStockChoice] = useState(fixedStock ? `existing:${fixedStock.id}` : "new");
  const [decisionDate, setDecisionDate] = useState(() => initialTransaction ? japanDate(initialTransaction.executedAt) : japanDate(new Date()));
  const [candidateTransactions, setCandidateTransactions] = useState<Transaction[]>(suppliedTransactions ?? []);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(initialTransaction?.id ?? null);
  const [recordTrade, setRecordTrade] = useState(false);
  const [reviewChoice, setReviewChoice] = useState("none");
  const [reviewDate, setReviewDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const effectiveStockId = fixedStock?.id ?? (stockChoice.startsWith("existing:") ? stockChoice.slice("existing:".length) : null);
  useEffect(() => {
    let active = true;
    if (!effectiveStockId) {
      setCandidateTransactions([]);
      setCandidatesLoading(false);
      setSelectedTransactionId(null);
      return () => { active = false; };
    }
    if (suppliedTransactions) {
      setCandidateTransactions(suppliedTransactions);
      setCandidatesLoading(false);
      return () => { active = false; };
    }
    setCandidatesLoading(true);
    setSelectedTransactionId(null);
    void listCaptureTransactionsAction({ stockId: effectiveStockId })
      .then((items) => { if (active) setCandidateTransactions(items); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "売買履歴を読み込めませんでした。"); })
      .finally(() => { if (active) setCandidatesLoading(false); });
    return () => { active = false; };
  }, [effectiveStockId, suppliedTransactions]);

  const selectedLinkedTransaction = candidateTransactions.find((item) => item.id === selectedTransactionId) ?? null;
  const transactionCandidates = effectiveStockId
    ? findTransactionCandidates(candidateTransactions, extraction.type, decisionDate, effectiveStockId)
    : [];
  useEffect(() => {
    const eligible = findTransactionCandidates(candidateTransactions, extraction.type, decisionDate, effectiveStockId ?? "");
    const sourceMatch = initialTransaction && eligible.some((item) => item.id === initialTransaction.id) ? initialTransaction.id : null;
    setSelectedTransactionId(sourceMatch ?? (eligible.length === 1 ? eligible[0].id : null));
  }, [candidateTransactions, extraction.type, decisionDate, effectiveStockId, initialTransaction]);

  const handleTranscript = useCallback((value: string) => {
    setTranscript(value);
    setRawInput(value);
  }, []);
  const voice = useVoiceTranscription(handleTranscript);

  async function extract(answer?: string) {
    if (!rawInput.trim()) {
      setError("記録する内容を入力してください。");
      return;
    }
    setError(null);
    setMode("extracting");
    try {
      const response = await fetch("/api/decisions/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawInput, ...(answer ? { followUpAnswer: answer } : {}) }),
      });
      const result = (await response.json()) as
        | DecisionExtraction
        | { error?: string };
      if (!response.ok) {
        throw new Error("error" in result ? result.error : undefined);
      }
      const extracted = DecisionExtractionSchema.parse(result);
      const confirmedExtraction = {
        ...extracted,
        ...(fixedStock ? { stock: { ticker: fixedStock.ticker, name: fixedStock.name, market: fixedStock.market } } : {}),
        ...(initialTransaction ? { type: initialDecisionType(initialTransaction) } : {}),
        transaction: extracted.transaction
          ? { ...extracted.transaction, executedAt: extracted.transaction.executedAt ?? new Date().toISOString() }
          : null,
      };
      setExtraction(confirmedExtraction);
      setRecordTrade(Boolean(confirmedExtraction.transaction));
      if (answer) setAskedQuestion(true);
      setMode("confirming");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "内容を整理できませんでした。もう一度お試しください。");
      setMode("writing");
    }
  }

  async function save() {
    if (candidatesLoading) {
      setError("売買履歴の読み込みが完了するまで保存できません。");
      return;
    }
    if (!extraction.stock.name.trim()) {
      setError("銘柄名を入力してください。");
      return;
    }
    if (reviewChoice === "earnings" && !reviewDate) {
      setError("次の決算日を入力してください。");
      return;
    }
    if (recordTrade && (!extraction.transaction?.quantity || extraction.transaction.quantity <= 0)) {
      setError("売買履歴を追加する場合は、確認画面で数量を入力してください。");
      return;
    }
    if (stockChoice === "new") {
      const normalizedName = extraction.stock.name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja-JP");
      const normalizedTicker = extraction.stock.ticker?.trim().toLocaleUpperCase("en-US") ?? null;
      const match = stocks.find((stock) => {
        const sameTicker = normalizedTicker && stock.ticker?.trim().toLocaleUpperCase("en-US") === normalizedTicker;
        const sameName = stock.name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja-JP") === normalizedName;
        return Boolean(sameTicker || sameName);
      });
      if (match) {
        setError(`「${match.name}」は登録済みです。銘柄の登録先で既存銘柄を選択してください。`);
        return;
      }
    }
    setMode("saving");
    setError(null);
    const reviewAt = reviewChoice === "none"
      ? null
      : reviewChoice === "month"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : reviewChoice === "quarter"
          ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(`${reviewDate}T12:00:00.000Z`).toISOString();
    const transactionInput = recordTrade && extraction.transaction?.quantity && extraction.transaction.quantity > 0 && extraction.transaction.executedAt
      ? {
          ...extraction.transaction,
          executedAt: extraction.transaction.executedAt,
        }
      : null;
    try {
      const saved = await saveDecisionAction({
        ...extraction,
        rawInput,
        transcript,
        followUpAnswer: questionAnswer.trim() || null,
        assumptions: linesToList(extraction.assumptions.join("\n").replace(/^/, "")),
        reviewConditions: linesToList(extraction.reviewConditions.join("\n").replace(/^/, "")),
        addConditions: linesToList(extraction.addConditions.join("\n").replace(/^/, "")),
        reviewAt,
        decidedAt: decisionDate,
        existingTransactionId: selectedLinkedTransaction?.id ?? null,
        transactionInput: selectedLinkedTransaction ? null : transactionInput,
        ...(stockChoice.startsWith("existing:") ? { stockId: stockChoice.slice("existing:".length) } : {}),
      });
      router.push(`/stocks/${saved.stockId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。入力内容を確認してもう一度お試しください。");
      setMode("confirming");
    }
  }

  function setArrayField(field: "assumptions" | "reviewConditions" | "addConditions", value: string) {
    setExtraction((current) => ({ ...current, [field]: linesToList(value) }));
  }

  const selectedStock = fixedStock ?? (stockChoice.startsWith("existing:")
    ? stocks.find((stock) => stock.id === stockChoice.slice("existing:".length))
    : undefined);

  return (
    <div className="space-y-6">
      <section className="surface p-5 sm:p-8">
        <p className="text-sm font-medium text-primary">投資判断ジャーナル</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">いま何を考えていますか？</h1>
        <p className="mt-2 text-sm text-muted-foreground">話すか、書いてください。保存する前に内容を確認できます。</p>
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-secondary/60 px-4 py-6">
          <button
            type="button"
            onClick={voice.recording ? voice.stopRecording : voice.startRecording}
            disabled={mode !== "writing" || voice.transcribing}
            aria-label={voice.recording ? "録音を停止" : "話して記録"}
            className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md transition ${voice.recording ? "bg-destructive" : "bg-primary hover:brightness-110"}`}
          >
            {voice.recording ? <Square aria-hidden size={24} /> : <Mic aria-hidden size={27} />}
          </button>
          <span className="text-sm font-medium">{voice.recording ? "録音中です。もう一度押すと停止します" : voice.transcribing ? "文字起こししています…" : "話して記録"}</span>
        </div>
        {voice.error && <p role="alert" className="mt-3 text-sm text-destructive">{voice.error}</p>}
        <label className="field-label mt-6" htmlFor="raw-input">テキストで入力する</label>
        <textarea
          id="raw-input"
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          disabled={mode === "extracting" || mode === "saving" || voice.recording || voice.transcribing}
          rows={5}
          placeholder="銘柄、判断したこと、その理由や見直し条件を自由に書いてください。"
          className="w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm leading-6 shadow-sm"
        />
        {transcript && <details className="mt-2 rounded-lg bg-secondary/50 p-3"><summary className="cursor-pointer text-xs font-medium">編集前の文字起こし原文</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{transcript}</p><p className="mt-2 text-xs text-muted-foreground">下の入力欄は文字起こしの誤りを修正できます。修正した文章とこの原文は別々に保存します。</p></details>}
        <button type="button" onClick={() => void extract()} disabled={mode !== "writing" || voice.recording || voice.transcribing || !rawInput.trim()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
          <WandSparkles size={17} aria-hidden />
          {voice.transcribing ? "文字起こししています…" : mode === "extracting" ? "整理しています…" : "内容を整理する"}
        </button>
      </section>

      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      {(mode === "confirming" || mode === "saving") && (
        <section className="surface space-y-5 p-5 sm:p-8" aria-labelledby="confirm-heading">
          <div>
            <p className="text-sm font-medium text-primary">保存前の確認</p>
            <h2 id="confirm-heading" className="mt-1 text-xl font-semibold">整理した内容を確認してください</h2>
          </div>
          {extraction.followUpQuestion && !askedQuestion && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <label className="field-label" htmlFor="follow-up">{extraction.followUpQuestion}</label>
              <textarea id="follow-up" value={questionAnswer} onChange={(event) => setQuestionAnswer(event.target.value)} rows={2} className="w-full rounded-lg border bg-background p-3 text-sm" />
              <button type="button" onClick={() => void extract(questionAnswer)} disabled={!questionAnswer.trim() || mode === "saving"} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">回答を反映</button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {!fixedStock && <label className="text-sm sm:col-span-2">銘柄の登録先<select value={stockChoice} onChange={(event) => setStockChoice(event.target.value)} disabled={mode === "saving"} className="mt-1 w-full rounded-lg border bg-background px-3 py-2"><option value="new">新しい銘柄として登録</option>{stocks.map((stock) => <option key={stock.id} value={`existing:${stock.id}`}>既存の銘柄: {stock.name}{stock.ticker ? ` (${stock.ticker})` : ""}</option>)}</select></label>}
            <label className="text-sm">銘柄名<input value={selectedStock?.name ?? extraction.stock.name} disabled={Boolean(selectedStock)} onChange={(event) => setExtraction((v) => ({ ...v, stock: { ...v.stock, name: event.target.value } }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 disabled:bg-secondary" /></label>
            <label className="text-sm">証券コード（任意）<input value={selectedStock?.ticker ?? extraction.stock.ticker ?? ""} disabled={Boolean(selectedStock)} onChange={(event) => setExtraction((v) => ({ ...v, stock: { ...v.stock, ticker: event.target.value || null } }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 disabled:bg-secondary" /></label>
            <label className="text-sm">記録日<input type="date" value={decisionDate} onChange={(event) => setDecisionDate(event.target.value)} disabled={mode === "saving"} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
            <label className="text-sm">記録の種類<select value={extraction.type} onChange={(event) => setExtraction((v) => ({ ...v, type: event.target.value as DecisionExtraction["type"] }))} disabled={mode === "saving"} className="mt-1 w-full rounded-lg border bg-background px-3 py-2"><option value="buy">購入</option><option value="add">買い増し</option><option value="sell_consideration">売却を検討</option><option value="sell">売却</option><option value="thesis_update">仮説の更新</option><option value="note">メモ</option></select></label>
            <label className="text-sm">投資仮説<textarea value={extraction.thesis ?? ""} onChange={(event) => setExtraction((v) => ({ ...v, thesis: event.target.value || null }))} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
            <label className="text-sm">前提（1行に1つ）<textarea value={extraction.assumptions.join("\n")} onChange={(event) => setArrayField("assumptions", event.target.value)} rows={3} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
            <label className="text-sm">見直し条件（1行に1つ）<textarea value={extraction.reviewConditions.join("\n")} onChange={(event) => setArrayField("reviewConditions", event.target.value)} rows={3} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
            <label className="text-sm">買い増し条件（1行に1つ）<textarea value={extraction.addConditions.join("\n")} onChange={(event) => setArrayField("addConditions", event.target.value)} rows={3} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 sm:col-span-2" /></label>
          </div>
          {effectiveStockId && <LinkedTransactionSelector
            transactions={transactionCandidates}
            value={selectedTransactionId}
            onChange={setSelectedTransactionId}
            loading={candidatesLoading}
            disabled={mode === "saving"}
          />}
          {!selectedLinkedTransaction && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recordTrade} disabled={mode === "saving"} onChange={(event) => { const enabled = event.target.checked; setRecordTrade(enabled); if (enabled && !extraction.transaction) setExtraction((v) => ({ ...v, transaction: { side: v.type === "sell" ? "sell" : "buy", quantity: null, price: null, fee: null, executedAt: new Date().toISOString() } })); }} />売買の事実も履歴に記録する</label>}
          {!selectedLinkedTransaction && recordTrade && extraction.transaction && (
            <fieldset className="rounded-xl border p-4">
              <legend className="px-1 text-sm font-semibold">売買履歴に追加</legend>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="text-sm">売買<select value={extraction.transaction.side} onChange={(event) => setExtraction((v) => ({ ...v, transaction: v.transaction ? { ...v.transaction, side: event.target.value as "buy" | "sell" } : null }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2"><option value="buy">購入</option><option value="sell">売却</option></select></label>
                <label className="text-sm">数量<input type="number" min="0.0001" step="any" value={extraction.transaction.quantity ?? ""} onChange={(event) => setExtraction((v) => ({ ...v, transaction: v.transaction ? { ...v.transaction, quantity: event.target.value ? Number(event.target.value) : null } : null }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
                <label className="text-sm">単価<input type="number" min="0" step="any" value={extraction.transaction.price ?? ""} onChange={(event) => setExtraction((v) => ({ ...v, transaction: v.transaction ? { ...v.transaction, price: event.target.value ? Number(event.target.value) : null } : null }))} placeholder="未入力" className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
                <label className="text-sm">約定日<input type="date" value={extraction.transaction.executedAt ? localDateInputValue(new Date(extraction.transaction.executedAt)) : localDateInputValue()} onChange={(event) => setExtraction((v) => ({ ...v, transaction: v.transaction ? { ...v.transaction, executedAt: new Date(`${event.target.value}T12:00:00.000Z`).toISOString() } : null }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
              </div>
            </fieldset>
          )}
          <fieldset className="rounded-xl border p-4">
            <legend className="px-1 text-sm font-semibold">振り返る時期（任意）</legend>
            <div className="flex flex-wrap gap-2">
              {[['none', '設定しない'], ['month', '1か月後'], ['quarter', '3か月後'], ['earnings', '次の決算'], ['date', '日付指定']].map(([value, label]) => <button type="button" key={value} aria-pressed={reviewChoice === value} onClick={() => setReviewChoice(value)} disabled={mode === "saving"} className={`rounded-full border px-3 py-1.5 text-sm ${reviewChoice === value ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{label}</button>)}
            </div>
            {(reviewChoice === "earnings" || reviewChoice === "date") && <label className="mt-3 block max-w-xs text-sm">振り返り日<input type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>}
          </fieldset>
          <details className="rounded-xl bg-secondary/50 p-4">
            <summary className="cursor-pointer text-sm font-medium">元の発言を確認</summary>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{rawInput}</p>
          </details>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={mode === "saving"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground disabled:opacity-60"><Check size={17} aria-hidden />{mode === "saving" ? "保存しています…" : "この内容で保存"}</button>
            <button type="button" onClick={() => setMode("writing")} disabled={mode === "saving"} className="rounded-lg border px-4 py-3 text-sm">入力に戻る</button>
          </div>
        </section>
      )}
    </div>
  );
}
