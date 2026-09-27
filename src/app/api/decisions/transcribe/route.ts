import { NextResponse } from "next/server";

import { transcribeAudio } from "@/lib/ai/gemini";

// Base64 expands audio by about one third; leave room within the API's 20 MB request limit.
const MAX_AUDIO_BYTES = 14 * 1024 * 1024;
const AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"]);

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "音声ファイルを確認してください。" }, { status: 400 });
  }
  const mimeType = audio.type.split(";")[0]?.toLowerCase();
  if (!mimeType || !AUDIO_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "対応していない音声形式です。" }, { status: 415 });
  }
  try {
    const transcript = await transcribeAudio({
      bytes: new Uint8Array(await audio.arrayBuffer()),
      mimeType,
    });
    return NextResponse.json({ transcript });
  } catch {
    return NextResponse.json({ error: "音声を文字起こしできませんでした。" }, { status: 502 });
  }
}
