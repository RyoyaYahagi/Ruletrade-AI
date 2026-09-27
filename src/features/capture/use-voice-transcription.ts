"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_AUDIO_BYTES = 14 * 1024 * 1024;
const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];

export function useVoiceTranscription(onTranscript: (value: string) => void) {
  const recorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const generation = useRef(0);
  const startPending = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    generation.current += 1;
    abortController.current?.abort();
    abortController.current = null;
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    recorder.current = null;
    stopStream();
    chunks.current = [];
    setRecording(false);
    setTranscribing(false);
    setError(null);
  }, [stopStream]);

  useEffect(() => () => cancel(), [cancel]);

  const startRecording = useCallback(async () => {
    if (startPending.current || recorder.current?.state === "recording") return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("このブラウザーは音声録音に対応していません。テキスト入力をご利用ください。");
      return;
    }
    const requestGeneration = generation.current;
    startPending.current = true;
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (requestGeneration !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      chunks.current = [];
      const mimeType = AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type));
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      mediaRecorder.onerror = () => {
        mediaRecorder.onstop = null;
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
        stopStream();
        setRecording(false);
        setError("録音中にエラーが発生しました。もう一度お試しください。");
      };
      mediaRecorder.onstop = async () => {
        stopStream();
        setRecording(false);
        const audio = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        const contentType = audio.type.split(";")[0]?.toLowerCase();
        if (!audio.size) {
          setError("録音データがありません。もう一度録音してください。");
          return;
        }
        if (audio.size > MAX_AUDIO_BYTES) {
          setError("録音は14MB以下にしてください。短く分けて録音してください。");
          return;
        }
        if (!contentType || !AUDIO_TYPES.includes(contentType)) {
          setError("対応していない音声形式です。テキスト入力をご利用ください。");
          return;
        }
        setTranscribing(true);
        const controller = new AbortController();
        abortController.current = controller;
        try {
          const formData = new FormData();
          formData.append("audio", audio, "recording.webm");
          const response = await fetch("/api/decisions/transcribe", { method: "POST", body: formData, signal: controller.signal });
          const result = (await response.json()) as { transcript?: string; error?: string };
          if (!response.ok || !result.transcript) throw new Error(result.error ?? "音声を文字起こしできませんでした。");
          if (requestGeneration === generation.current) onTranscript(result.transcript);
        } catch (cause) {
          if (requestGeneration === generation.current) setError(cause instanceof Error ? cause.message : "音声を送信できませんでした。テキスト入力をご利用ください。");
        } finally {
          if (requestGeneration === generation.current) {
            abortController.current = null;
            setTranscribing(false);
          }
        }
      };
      mediaRecorder.start();
      setRecording(true);
    } catch (cause) {
      stopStream();
      if (requestGeneration !== generation.current) return;
      const denied = cause instanceof DOMException && cause.name === "NotAllowedError";
      setError(denied
        ? "マイクの使用が許可されていません。ブラウザーの設定でマイクを許可するか、テキスト入力をご利用ください。"
        : "マイクを開始できませんでした。接続とブラウザーの設定を確認してください。");
    } finally {
      startPending.current = false;
      setStarting(false);
    }
  }, [onTranscript, stopStream]);

  const stopRecording = useCallback(() => recorder.current?.stop(), []);

  return { recording, starting, transcribing, error, startRecording, stopRecording, cancel };
}
