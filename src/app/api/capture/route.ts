import { NextResponse } from "next/server";
import { z } from "zod";

import {
  structureDecisionAudio,
  structureDecisionText,
} from "@/lib/gemini";

export const runtime = "nodejs";

const textRequestSchema = z.object({
  text: z.string().trim().min(1).max(8000),
});

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const audio = form.get("audio");

      if (!(audio instanceof File) || audio.size === 0) {
        return NextResponse.json(
          { error: "音声ファイルがありません。" },
          { status: 400 },
        );
      }

      if (audio.size > 12 * 1024 * 1024) {
        return NextResponse.json(
          { error: "音声は12MB以下にしてください。" },
          { status: 413 },
        );
      }

      const draft = await structureDecisionAudio(
        Buffer.from(await audio.arrayBuffer()),
        audio.type || "audio/webm",
      );

      return NextResponse.json({ draft });
    }

    const { text } = textRequestSchema.parse(await request.json());
    const draft = await structureDecisionText(text);
    return NextResponse.json({ draft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "入力の解析に失敗しました。";
    const status = message.includes("GEMINI_API_KEY") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
