import { NextResponse } from "next/server";

import {
  getStock,
  listDecisions,
  saveReview,
} from "@/lib/db";
import { reviewInputSchema } from "@/lib/domain";
import { compareWithHistory } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const stock = getStock(id);

    if (!stock) {
      return NextResponse.json({ error: "銘柄が見つかりません。" }, { status: 404 });
    }

    const { currentText } = reviewInputSchema.parse(await request.json());
    const decisions = listDecisions(id);

    if (decisions.length === 0) {
      return NextResponse.json(
        { error: "比較できる過去の判断がまだありません。" },
        { status: 400 },
      );
    }

    const comparison = await compareWithHistory(
      stock.ticker,
      decisions,
      currentText,
    );

    saveReview(id, currentText, comparison);
    return NextResponse.json({ comparison }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "レビューに失敗しました。";
    const status = message.includes("GEMINI_API_KEY") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
