import { NextResponse } from "next/server";
import { z } from "zod";

import { extractDecision } from "@/lib/ai/gemini";
import { DecisionExtractionSchema } from "@/schemas/decision";

const RequestSchema = z.object({
  rawInput: z.string().trim().min(1).max(20000),
  followUpAnswer: z.string().trim().min(1).max(5000).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  }
  try {
    const extraction = DecisionExtractionSchema.parse(await extractDecision(parsed.data));
    return NextResponse.json(extraction);
  } catch {
    return NextResponse.json({ error: "判断内容を整理できませんでした。入力を確認して再試行してください。" }, { status: 502 });
  }
}
