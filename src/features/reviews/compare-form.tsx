"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDecisionAction, saveReviewAction } from "@/features/decisions/actions";
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
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [comparison, setComparison] = useState<DecisionComparison | null>(null);
  const [reflection, setReflection] = useState("");
  const [recordSale, setRecordSale] = useState(false);
  const [saleQuantity, setSaleQuantity] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState(localDateInputValue());
  const [pendingSellDecisionId, setPendingSellDecisionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => () => {
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("このブラウザーは音声録音に対応していません。テキスト入力をご利用ください。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunks.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };
      mediaRecorder.onerror = () => {
        mediaRecorder.onstop = null;
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        setError("録音中にエラーが発生しました。もう一度お試しください。");
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        const audio = new Blob(audioChunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        if (audio.size === 0 || audio.size > 20 * 1024 * 1024) {
          setError(audio.size === 0 ? "録音データがありません。" : "録音は20MB以下にしてください。");
          return;
        }
        setLoading(true);
        setTranscribing(true);
        try {
          const body = new FormData();
          body.append("audio", audio, "recording.webm");
          const response = await fetch("/api/decisions/transcribe", { method: "POST", body });
          const result = (await response.json()) as { transcript?: string; error?: string };
          if (!response.ok || !result.transcript) throw new Error(result.error ?? "音声を文字起こしできませんでした。");
          setSaleTranscript(result.transcript);
          setCurrentInput(result.transcript);
          setComparison(null);
          setSaved(false);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "音声を送信できませんでした。テキスト入力をご利用ください。");
        } finally {
          setTranscribing(false);
          setLoading(false);
        }
      };
      mediaRecorder.start();
      setRecording(true);
    } catch (cause) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "マイクの使用が許可されていません。ブラウザーの設定で許可するか、テキスト入力をご利用ください。"
        : "マイクを開始できませんでした。ブラウザーの設定を確認してください。");
    }
  }

  async function compare() {
    if (!currentInput.trim()) return;
    setLoading(true);
    setError(null);
    setSaved(false);
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
          thesis: currentInput,
          assumptions: [],
          reviewConditions: [],
          addConditions: [],
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
      setSaved(true);
      setComparison(null);
      setCurrentInput("");
      setSaleTranscript(null);
      setReflection("");
      setPendingSellDecisionId(null);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "振り返りを保存できませんでした。";
      setError(sellCreated
        ? `売却判断と取引は保存済みです。比較の振り返りは保存できませんでした: ${message}`
        : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface p-5 sm:p-7" aria-labelledby="compare-heading">
      <p className="text-sm font-medium text-primary">過去の自分と振り返る</p>
      <h2 id="compare-heading" className="mt-1 text-xl font-semibold">いまの考えを過去の記録と比べる</h2>
      <p className="mt-2 text-sm text-muted-foreground">AIは売買を勧めず、過去の記録と現在の考えの違いを整理します。</p>
      {reviewDecision && <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-sm">振り返る判断: {reviewDecision.thesis ?? reviewDecision.rawInput}</p>}
      <label htmlFor="current-thought" className="field-label mt-5">現在の考え</label>
      <button type="button" onClick={recording ? () => recorder.current?.stop() : startRecording} disabled={loading} aria-label={recording ? "録音を停止" : "売却理由を話して記録"} className={`mb-3 flex h-14 w-14 items-center justify-center rounded-full text-white ${recording ? "bg-destructive" : "bg-primary"}`}><span aria-hidden>{recording ? "■" : "🎙️"}</span></button>
      {transcribing && <p role="status" className="mb-2 text-sm text-muted-foreground">文字起こししています…</p>}
      <p className="mb-2 text-sm text-muted-foreground">売却理由は話すか、下の欄へ入力できます。</p>
      <textarea id="current-thought" value={currentInput} onChange={(event) => { setCurrentInput(event.target.value); setComparison(null); setSaved(false); }} disabled={recording || loading || Boolean(pendingSellDecisionId)} rows={4} placeholder="たとえば、株価が下がったので売却を考えている。" className="w-full rounded-xl border bg-background px-4 py-3 text-sm leading-6 disabled:opacity-60" />
      {saleTranscript && <details className="mt-2 rounded-lg bg-secondary/50 p-3"><summary className="cursor-pointer text-xs font-medium">文字起こし原文</summary><p className="mt-2 whitespace-pre-wrap text-sm">{saleTranscript}</p><p className="mt-2 text-xs text-muted-foreground">入力欄で誤りを直せます。原文と修正後の文章を別々に保存します。</p></details>}
      <button type="button" onClick={() => void compare()} disabled={!currentInput.trim() || loading || recording} className="mt-4 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{transcribing ? "文字起こししています…" : loading ? "過去の記録を確認しています…" : "過去の判断と比べる"}</button>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {saved && <p role="status" className="mt-4 text-sm text-primary">振り返りを保存しました。</p>}
      {comparison && (
        <div className="mt-5 space-y-4 rounded-xl bg-secondary/60 p-4 sm:p-5">
          <div><h3 className="font-semibold">過去の判断との比較</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{comparison.summary}</p></div>
          {comparison.differences.length > 0 && <div><h3 className="text-sm font-semibold">異なる点</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{comparison.differences.map((difference, index) => <li key={`${index}-${difference}`}>{difference}</li>)}</ul></div>}
          <label htmlFor="reflection" className="field-label">自分の振り返り</label>
          <textarea id="reflection" value={reflection} onChange={(event) => setReflection(event.target.value)} rows={3} placeholder="今回の判断について、あとで読み返したいことを書いてください。" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recordSale} disabled={Boolean(pendingSellDecisionId)} onChange={(event) => setRecordSale(event.target.checked)} />売却判断と取引も記録する</label>
          {recordSale && <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">売却数量<input type="number" min="0.0001" step="any" value={saleQuantity} disabled={Boolean(pendingSellDecisionId)} onChange={(event) => setSaleQuantity(event.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 disabled:bg-secondary" /></label><label className="text-sm">単価（任意）<input type="number" min="0" step="any" value={salePrice} disabled={Boolean(pendingSellDecisionId)} onChange={(event) => setSalePrice(event.target.value)} placeholder="未入力" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 disabled:bg-secondary" /></label><label className="text-sm">約定日<input type="date" value={saleDate} disabled={Boolean(pendingSellDecisionId)} onChange={(event) => setSaleDate(event.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 disabled:bg-secondary" /></label></div>}
          <button type="button" onClick={() => void saveReview()} disabled={!reflection.trim() || loading || recording} className="rounded-lg border bg-card px-4 py-2 text-sm font-medium disabled:opacity-50">比較と振り返りを保存</button>
        </div>
      )}
    </section>
  );
}
