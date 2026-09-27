"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { useVoiceTranscription } from "@/features/capture/use-voice-transcription";

type Submission = { number: number; url: string };

export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [inputMethod, setInputMethod] = useState<"text" | "voice">("text");
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleTranscript = useCallback((transcript: string) => {
    setMessage((current) => current ? `${current}\n${transcript}` : transcript);
    setInputMethod("voice");
    setError(null);
  }, []);
  const voice = useVoiceTranscription(handleTranscript);
  const cancelVoice = voice.cancel;

  function resetAfterSuccess() {
    setMessage("");
    setInputMethod("text");
    setSubmission(null);
    setError(null);
  }

  function closeDialog() {
    cancelVoice();
    if (submission) resetAfterSuccess();
    onClose();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) cancelVoice();
  }, [open, cancelVoice]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || submitting || voice.starting || voice.recording || voice.transcribing) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, inputMethod }),
      });
      const result = (await response.json()) as Submission | { error?: string };
      if (!response.ok || !("number" in result) || !("url" in result)) {
        throw new Error("error" in result ? result.error : undefined);
      }
      if (dialogRef.current?.open) setSubmission(result);
      else resetAfterSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "送信できませんでした。入力内容を残したまま、もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="feedback-title"
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,34rem)] overflow-y-auto rounded-2xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/45"
    >
      <div className="flex items-start justify-between gap-4 border-b p-5 sm:p-6">
        <div>
          <h2 id="feedback-title" className="text-xl font-semibold">お問い合わせ・改善要望</h2>
          <p className="mt-1 text-sm text-muted-foreground">使いにくい点や気づいたことをお聞かせください。</p>
        </div>
        <button type="button" onClick={closeDialog} aria-label="閉じる" className="rounded-md p-2 text-muted-foreground hover:bg-secondary">
          <X size={18} aria-hidden />
        </button>
      </div>
      {submission ? (
        <div className="space-y-4 p-5 sm:p-6" role="status">
          <p className="font-medium">送信しました（#{submission.number}）</p>
          <p className="text-sm text-muted-foreground">ご意見を受け付けました。送信内容はいつでも確認できます。</p>
          <div className="flex flex-wrap gap-3">
            <a href={submission.url} target="_blank" rel="noreferrer" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">受付内容を確認</a>
            <button type="button" onClick={closeDialog} className="rounded-lg border px-4 py-2 text-sm">閉じる</button>
          </div>
          <button type="button" onClick={resetAfterSuccess} className="text-sm text-primary underline underline-offset-4">新しい問い合わせを送る</button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-4 p-5 sm:p-6">
          <div className="rounded-xl bg-secondary/50 p-4">
            <button
              type="button"
              onClick={voice.recording ? voice.stopRecording : voice.startRecording}
              disabled={submitting || voice.starting || voice.transcribing}
              aria-label={voice.recording ? "録音を停止" : "話して入力"}
              className={`flex h-12 items-center gap-2 rounded-full px-5 text-sm font-medium text-white disabled:opacity-60 ${voice.recording ? "bg-destructive" : "bg-primary"}`}
            >
              {voice.recording ? <Square size={17} aria-hidden /> : <Mic size={18} aria-hidden />}
              {voice.recording ? "録音を停止" : voice.starting ? "マイクを準備しています…" : voice.transcribing ? "文字起こししています…" : "話して入力"}
            </button>
            <p className="mt-2 text-xs text-muted-foreground">音声は文字に変換され、送信前に編集できます。</p>
          </div>
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-muted-foreground">送信内容は公開 GitHub issue に登録されます。氏名、メールアドレス、口座情報などの個人情報は入力しないでください。</p>
          <label htmlFor="feedback-message" className="field-label">お問い合わせ内容</label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={submitting || voice.starting || voice.recording || voice.transcribing}
            required
            minLength={1}
            maxLength={10000}
            rows={6}
            placeholder="お問い合わせや改善してほしい点を入力してください。"
            className="w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm leading-6 shadow-sm disabled:opacity-60"
          />
          <div className="flex justify-between text-xs text-muted-foreground"><span>最大10,000文字</span><span>{message.length} / 10,000</span></div>
          {(error || voice.error) && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error ?? voice.error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={closeDialog} className="rounded-lg border px-4 py-2.5 text-sm">キャンセル</button>
            <button type="submit" disabled={submitting || voice.starting || voice.recording || voice.transcribing || !message.trim()} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "送信しています…" : "送信する"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
