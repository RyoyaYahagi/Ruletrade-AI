"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { DecisionDraft } from "@/lib/domain";

const kindLabels: Record<DecisionDraft["kind"], string> = {
  buy: "購入",
  add: "買い増し",
  sell: "売却",
  review: "見直し",
  note: "メモ",
};

function lines(values: string[]) {
  return values.join("\n");
}

function toLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function CapturePanel() {
  const router = useRouter();
  const chunks = useRef<Blob[]>([]);
  const activeStream = useRef<MediaStream | null>(null);

  const [text, setText] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [draft, setDraft] = useState<DecisionDraft | null>(null);
  const [reviewAt, setReviewAt] = useState("");
  const [status, setStatus] = useState("");

  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setStatus("このブラウザでは録音を利用できません。文章入力を使ってください。");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const nextRecorder = new MediaRecorder(stream);
      activeStream.current = stream;
      chunks.current = [];

      nextRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };

      nextRecorder.onstop = () => {
        const blob = new Blob(chunks.current, {
          type: nextRecorder.mimeType || "audio/webm",
        });
        setAudio(blob);
        activeStream.current?.getTracks().forEach((track) => track.stop());
        activeStream.current = null;
      };

      nextRecorder.start();
      setRecorder(nextRecorder);
      setAudio(null);
      setDraft(null);
      setStatus("録音中… 話し終わったら停止してください。");
    } catch {
      setStatus("マイクを開始できませんでした。ブラウザの権限を確認してください。");
    }
  }

  function stopRecording() {
    recorder?.stop();
    setRecorder(null);
    setStatus("録音しました。解析すると文字起こしと整理を行います。");
  }

  async function parseInput() {
    setStatus("AIが内容を整理中…");
    setDraft(null);

    let response: Response;

    if (audio) {
      const form = new FormData();
      form.append(
        "audio",
        new File([audio], "decision.webm", {
          type: audio.type || "audio/webm",
        }),
      );
      response = await fetch("/api/capture", {
        method: "POST",
        body: form,
      });
    } else {
      if (!text.trim()) {
        setStatus("話すか、文章を入力してください。");
        return;
      }
      response = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
    }

    const body = (await response.json()) as {
      draft?: DecisionDraft;
      error?: string;
    };

    if (!response.ok || !body.draft) {
      setStatus(body.error || "解析に失敗しました。");
      return;
    }

    setDraft(body.draft);
    setStatus("内容を確認してから保存してください。");
  }

  async function save() {
    if (!draft) return;
    if (!draft.ticker?.trim()) {
      setStatus("銘柄コードを入力してください。AIには推測させない設計です。");
      return;
    }

    setStatus("保存中…");
    const response = await fetch("/api/decisions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...draft,
        ticker: draft.ticker,
        reviewAt: reviewAt || null,
      }),
    });

    const body = (await response.json()) as {
      stockId?: string;
      error?: string;
    };

    if (!response.ok || !body.stockId) {
      setStatus(body.error || "保存に失敗しました。");
      return;
    }

    router.push(`/stocks/${body.stockId}`);
    router.refresh();
  }

  return (
    <section className="capture" aria-labelledby="capture-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">QUICK CAPTURE</p>
          <h2 id="capture-title">今の判断を、そのまま残す</h2>
        </div>
        <p className="muted">
          きれいに書かなくて大丈夫です。話すか書いた後、AIの整理結果を自分で確認して保存します。
        </p>
      </div>

      <div className="capture-input">
        <textarea
          rows={5}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (event.target.value) setAudio(null);
          }}
          placeholder="例：今日JX金属を買った。データセンター向け需要が伸びると思っている。銅価格が大きく崩れたら見直したい。"
          disabled={Boolean(recorder)}
        />

        <div className="action-row">
          {recorder ? (
            <button className="button danger" type="button" onClick={stopRecording}>
              ■ 録音を停止
            </button>
          ) : (
            <button className="button secondary" type="button" onClick={startRecording}>
              ● 音声で話す
            </button>
          )}
          <button className="button" type="button" onClick={parseInput} disabled={Boolean(recorder)}>
            {audio ? "音声を文字起こし・整理" : "文章を整理"}
          </button>
          {audio && <span className="muted small">音声を1件録音済み</span>}
        </div>

        {status && <p className="status">{status}</p>}
      </div>

      {draft && (
        <div className="preview">
          <div className="preview-title">
            <h3>保存前の確認</h3>
            <span>AIの抽出結果は自由に直せます</span>
          </div>

          <div className="row">
            <label>
              銘柄コード
              <input
                value={draft.ticker || ""}
                onChange={(e) => setDraft({ ...draft, ticker: e.target.value || null })}
                placeholder="例：5016"
                required
              />
            </label>
            <label>
              銘柄名
              <input
                value={draft.companyName || ""}
                onChange={(e) =>
                  setDraft({ ...draft, companyName: e.target.value || null })
                }
                placeholder="例：JX金属"
              />
            </label>
            <label>
              種類
              <select
                value={draft.kind}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    kind: e.target.value as DecisionDraft["kind"],
                  })
                }
              >
                {Object.entries(kindLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            元の発話・文章
            <textarea
              rows={4}
              value={draft.rawText}
              onChange={(e) => setDraft({ ...draft, rawText: e.target.value })}
            />
          </label>

          <label>
            なぜそう判断した？
            <textarea
              rows={3}
              value={draft.thesis || ""}
              onChange={(e) => setDraft({ ...draft, thesis: e.target.value || null })}
            />
          </label>

          <div className="row">
            <label>
              前提
              <textarea
                rows={4}
                value={lines(draft.assumptions)}
                onChange={(e) => setDraft({ ...draft, assumptions: toLines(e.target.value) })}
                placeholder="1行に1つ"
              />
            </label>
            <label>
              売る・見直す条件
              <textarea
                rows={4}
                value={lines(draft.exitConditions)}
                onChange={(e) => setDraft({ ...draft, exitConditions: toLines(e.target.value) })}
                placeholder="1行に1つ"
              />
            </label>
            <label>
              買い増し条件
              <textarea
                rows={4}
                value={lines(draft.addConditions)}
                onChange={(e) => setDraft({ ...draft, addConditions: toLines(e.target.value) })}
                placeholder="1行に1つ"
              />
            </label>
          </div>

          <label className="date-field">
            見直す日（任意）
            <input type="date" value={reviewAt} onChange={(e) => setReviewAt(e.target.value)} />
          </label>

          <div className="action-row">
            <button className="button" type="button" onClick={save}>
              この判断を保存
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setDraft(null);
                setReviewAt("");
              }}
            >
              やり直す
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
