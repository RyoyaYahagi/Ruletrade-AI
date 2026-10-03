"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square } from "lucide-react";
import { saveDecisionAction, saveReviewAction } from "@/features/decisions/actions";
import { useVoiceTranscription } from "@/features/capture/use-voice-transcription";
import type { Decision } from "@/schemas/decision";
import type { DecisionComparison } from "@/schemas/review";
import type { Stock } from "@/schemas/stock";

function localDateInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function CompareForm({ stock, reviewDecision }: { stock: Stock; reviewDecision: Decision | null }) {
  const stockId = stock.id;
  const router = useRouter();
  const [currentInput, setCurrentInput] = useState("");
  const [saleTranscript, setSaleTranscript] = useState<string | null>(null);
  const [comparison, setComparison] = useState<DecisionComparison | null>(null);
  const [reflection, setReflection] = useState("");
  const [recordSale, setRecordSale] = useState(false);
  const [saleQuantity, setSaleQuantity] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState(localDateInputValue());
  const [pendingSellDecisionId, setPendingSellDecisionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleTranscript = useCallback((transcript: string) => {
    setSaleTranscript(transcript);
    setCurrentInput(transcript);
    setComparison(null);
  }, []);
  const voice = useVoiceTranscription(handleTranscript);
  const busy = loading || voice.starting || voice.recording || voice.transcribing;

  async function compare() {
    if (!currentInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/reviews/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stockId, currentInput }),
      });
      const result = (await response.json()) as DecisionComparison | { error?: string };
      if (!response.ok) throw new Error("error" in result ? result.error : undefined);
      setComparison(result as DecisionComparison);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "過去の判断と比較できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  async function saveReview() {
    if (!comparison || !reflection.trim()) return;
    if (recordSale && (!saleQuantity || Number(saleQuantity) <= 0)) {
      setError("売却数量を入力してください。");
      return;
    }
    setLoading(true);
    setError(null);
    let sellCreated = Boolean(pendingSellDecisionId);
    let reviewDecisionId = pendingSellDecisionId;
    try {
      if (recordSale && !pendingSellDecisionId) {
        const saleDecision = await saveDecisionAction({
          stockId,
          type: "sell",
          stock,
          rawInput: currentInput,
          transcript: saleTranscript,
          followUpAnswer: null,
          summary: currentInput,
          points: [],
          followUpQuestion: null,
          transaction: null,
          transactionInput: {
            side: "sell",
            quantity: Number(saleQuantity),
            price: salePrice ? Number(salePrice) : null,
            fee: null,
            executedAt: new Date(`${saleDate}T12:00:00.000Z`).toISOString(),
          },
        });
        setPendingSellDecisionId(saleDecision.decisionId);
        sellCreated = true;
        reviewDecisionId = saleDecision.decisionId;
      }
      await saveReviewAction({
        stockId,
        decisionId: reviewDecision?.id ?? reviewDecisionId,
        currentInput,
        summary: comparison.summary,
        differences: comparison.differences,
        reflection: reflection.trim(),
      });
      router.push(`/stocks/${stockId}?tab=reviews`);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "振り返りを保存できませんでした。";
      setError(sellCreated
        ? `売却判断と取引は保存済みです。比較の振り返りは保存できませんでした: ${message}`
        : message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-labelledby="now-heading">
        <h2 id="now-heading" className="section-label">いまのあなた</h2>
        <div className="surface space-y-3 p-5">
          <label htmlFor="current-thought" className="sr-only">現在の考え</label>
          <textarea
            id="current-thought"
            value={currentInput}
            onChange={(event) => { setCurrentInput(event.target.value); setComparison(null); }}
            disabled={busy || Boolean(pendingSellDecisionId)}
            rows={5}
            placeholder="いまはどう考えていますか？ 売却を考えているなら、その理由も。"
            className="journal-text w-full resize-y bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
          />
          {saleTranscript && (
            <details className="rounded-xl bg-secondary p-3">
              <summary className="cursor-pointer text-xs font-medium">文字起こし原文</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm">{saleTranscript}</p>
              <p className="mt-2 text-xs text-muted-foreground">入力欄で誤りを直せます。原文と修正後の文章を別々に保存します。</p>
            </details>
          )}
          {voice.transcribing && <p role="status" className="text-sm text-muted-foreground">文字起こししています…</p>}
          {voice.error && <p role="alert" className="text-sm text-destructive">{voice.error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={voice.recording ? voice.stopRecording : () => void voice.startRecording()}
              disabled={loading || voice.transcribing || Boolean(pendingSellDecisionId)}
              aria-label={voice.recording ? "録音を停止" : "話して入力"}
              className={`flex size-12 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${voice.recording ? "bg-destructive text-white" : "border-[1.5px] border-primary text-primary"}`}
            >
              {voice.recording ? <Square aria-hidden size={20} /> : <Mic aria-hidden size={22} />}
            </button>
            <button
              type="button"
              onClick={() => void compare()}
              disabled={!currentInput.trim() || busy}
              className="button-soft min-h-12 flex-1"
            >
              {loading && !comparison ? "過去の記録を確認しています…" : "過去の判断と比べる"}
            </button>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      {comparison && (
        <>
          <section className="space-y-2" aria-labelledby="comparison-heading">
            <div className="flex items-center gap-2 px-1">
              <h2 id="comparison-heading" className="text-sm font-semibold text-muted-foreground">過去の判断との比較</h2>
              <span className="rounded-md bg-ai-soft px-1.5 py-0.5 text-[11px] font-semibold text-ai">AIは売買を勧めません</span>
            </div>
            <div className="surface space-y-3 p-5 leading-7">
              <p className="whitespace-pre-wrap">{comparison.summary}</p>
              {comparison.differences.length > 0 && (
                <div className="border-t pt-3">
                  <h3 className="text-xs font-semibold text-ai">異なる点</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {comparison.differences.map((difference, index) => <li key={`${index}-${difference}`}>{difference}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <label htmlFor="reflection" className="section-label block">自分の振り返り</label>
            <div className="surface p-5">
              <textarea
                id="reflection"
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
                rows={3}
                placeholder="違いを見て気づいたこと、あとで読み返したいこと"
                className="journal-text w-full resize-y bg-transparent outline-none placeholder:text-muted-foreground/70"
              />
            </div>
            <div className="surface space-y-3 p-5">
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={recordSale}
                  disabled={Boolean(pendingSellDecisionId)}
                  onChange={(event) => setRecordSale(event.target.checked)}
                  className="size-5 accent-primary"
                />
                売却判断と取引も記録する
              </label>
              {recordSale && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm text-muted-foreground">売却数量<input type="number" min="0.0001" step="any" value={saleQuantity} disabled={Boolean(pendingSellDecisionId)} onChange={(event) => setSaleQuantity(event.target.value)} className="input mt-1 text-foreground disabled:bg-secondary" /></label>
                  <label className="text-sm text-muted-foreground">単価（任意）<input type="number" min="0" step="any" value={salePrice} disabled={Boolean(pendingSellDecisionId)} onChange={(event) => setSalePrice(event.target.value)} placeholder="未入力" className="input mt-1 text-foreground disabled:bg-secondary" /></label>
                  <label className="text-sm text-muted-foreground">約定日<input type="date" value={saleDate} disabled={Boolean(pendingSellDecisionId)} onChange={(event) => setSaleDate(event.target.value)} className="input mt-1 text-foreground disabled:bg-secondary" /></label>
                </div>
              )}
            </div>
          </section>

          <div className="action-bar">
            <button type="button" onClick={() => void saveReview()} disabled={!reflection.trim() || busy} className="button-primary min-h-14 w-full">
              {loading ? "保存しています…" : "比較と振り返りを保存"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
